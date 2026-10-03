package dev.gridtwin.domain.topology;

import dev.gridtwin.domain.topology.OperationResult.Accepted;
import dev.gridtwin.domain.topology.OperationResult.Refused;
import dev.gridtwin.domain.topology.Refusal.BreakerNotOpen;
import dev.gridtwin.domain.topology.Refusal.EarthedSectionWouldBeEnergized;
import dev.gridtwin.domain.topology.Refusal.SectionEnergized;
import dev.gridtwin.domain.topology.Refusal.UnknownSwitch;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

public final class Interlocks {

    private Interlocks() {}

    public static OperationResult check(
            Substation substation,
            Topology topology,
            SwitchPositions positions,
            String switchId,
            Position target) {
        Optional<Switch> found = substation.findSwitch(switchId);
        if (found.isEmpty()) {
            return new Refused(new UnknownSwitch(switchId));
        }
        Switch candidate = found.get();
        if (positions.of(switchId) == target) {
            return new Accepted(switchId, target, false);
        }
        Optional<Refusal> refusal = refusalFor(substation, topology, positions, candidate, target);
        return refusal.<OperationResult>map(Refused::new)
                .orElseGet(() -> new Accepted(switchId, target, true));
    }

    private static Optional<Refusal> refusalFor(
            Substation substation,
            Topology topology,
            SwitchPositions positions,
            Switch candidate,
            Position target) {
        return switch (candidate.kind()) {
            case BREAKER ->
                    target == Position.OPEN
                            ? Optional.empty()
                            : closingRefusal(substation, topology, candidate);
            case DISCONNECTOR ->
                    breakerRefusal(substation, positions, candidate)
                            .or(
                                    () ->
                                            target == Position.OPEN
                                                    ? Optional.empty()
                                                    : closingRefusal(
                                                            substation, topology, candidate));
            case EARTHING_SWITCH ->
                    target == Position.OPEN
                            ? Optional.empty()
                            : earthingRefusal(substation, topology, candidate);
        };
    }

    private static Optional<Refusal> breakerRefusal(
            Substation substation, SwitchPositions positions, Switch disconnector) {
        Switch breaker = substation.breakerOf(disconnector.bayId());
        return positions.isClosed(breaker.id())
                ? Optional.of(new BreakerNotOpen(disconnector.id(), breaker.id()))
                : Optional.empty();
    }

    private static Optional<Refusal> earthingRefusal(
            Substation substation, Topology topology, Switch earthing) {
        NodeSet section = topology.nodeSetOf(earthing.nodeA());
        return section.live()
                ? Optional.of(new SectionEnergized(earthing.id(), describe(substation, section)))
                : Optional.empty();
    }

    private static Optional<Refusal> closingRefusal(
            Substation substation, Topology topology, Switch closing) {
        NodeSet first = topology.nodeSetOf(closing.nodeA());
        NodeSet second = topology.nodeSetOf(closing.nodeB());
        if (first.id().equals(second.id())) {
            return Optional.empty();
        }
        if (first.earthed() && second.live()) {
            return Optional.of(
                    new EarthedSectionWouldBeEnergized(
                            closing.id(),
                            describe(substation, first),
                            describe(substation, second)));
        }
        if (second.earthed() && first.live()) {
            return Optional.of(
                    new EarthedSectionWouldBeEnergized(
                            closing.id(),
                            describe(substation, second),
                            describe(substation, first)));
        }
        return Optional.empty();
    }

    static String describe(Substation substation, NodeSet section) {
        List<String> names =
                substation.busbars().stream()
                        .filter(busbar -> section.contains(busbar.nodeId()))
                        .map(Busbar::name)
                        .toList();
        if (!names.isEmpty()) {
            return "the section with " + names.stream().collect(Collectors.joining(" and "));
        }
        return "the section around " + section.id();
    }
}
