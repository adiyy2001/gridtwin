package dev.gridtwin.domain.topology;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public record Substation(
        String id,
        String name,
        int busNumber,
        double baseKv,
        List<Busbar> busbars,
        List<Node> nodes,
        List<Bay> bays,
        List<Switch> switches) {

    public Substation {
        if (busNumber <= 0) {
            throw new IllegalArgumentException("substation bus number must be positive");
        }
        if (baseKv <= 0) {
            throw new IllegalArgumentException("substation voltage must be positive");
        }
        busbars = List.copyOf(busbars);
        nodes = List.copyOf(nodes);
        bays = List.copyOf(bays);
        switches = List.copyOf(switches);
        if (busbars.isEmpty()) {
            throw new IllegalArgumentException("a substation needs at least one busbar");
        }
        Set<String> nodeIds = requireUnique(nodes.stream().map(Node::id), "node");
        requireUnique(bays.stream().map(Bay::id), "bay");
        requireUnique(switches.stream().map(Switch::id), "switch");
        requireUnique(busbars.stream().map(Busbar::nodeId), "busbar node");
        requireUnique(busbars.stream().map(busbar -> String.valueOf(busbar.busNumber())), "busbar");
        requireKnownNodes(nodeIds, busbars.stream().map(Busbar::nodeId), "busbar");
        requireOwnBusbar(busbars, busNumber);
        requireKnownNodes(
                nodeIds,
                bays.stream().flatMap(bay -> bay.terminal().stream()).map(Terminal::nodeId),
                "terminal");
        requireKnownNodes(
                nodeIds,
                switches.stream()
                        .flatMap(Substation::switchEnds)
                        .filter(node -> !Switch.EARTH.equals(node)),
                "switch");
        requireBaysForSwitches(bays, switches);
        requireOneBreakerPerBay(bays, switches);
    }

    public Optional<Switch> findSwitch(String switchId) {
        return this.switches.stream()
                .filter(candidate -> candidate.id().equals(switchId))
                .findFirst();
    }

    public Optional<Bay> findBay(String bayId) {
        return this.bays.stream().filter(candidate -> candidate.id().equals(bayId)).findFirst();
    }

    public List<Switch> switchesOf(String bayId) {
        return this.switches.stream().filter(candidate -> candidate.bayId().equals(bayId)).toList();
    }

    public Switch breakerOf(String bayId) {
        return this.switchesOf(bayId).stream()
                .filter(candidate -> candidate.kind() == SwitchKind.BREAKER)
                .findFirst()
                .orElseThrow();
    }

    public SwitchPositions initialPositions() {
        Map<String, Position> positions = new HashMap<>();
        this.switches.forEach(
                candidate -> positions.put(candidate.id(), candidate.initialPosition()));
        return new SwitchPositions(positions);
    }

    private static void requireOwnBusbar(List<Busbar> busbars, int busNumber) {
        int lowest = busbars.stream().mapToInt(Busbar::busNumber).min().orElseThrow();
        if (lowest != busNumber) {
            throw new IllegalArgumentException(
                    "the lowest busbar bus number "
                            + lowest
                            + " must equal the substation bus "
                            + busNumber);
        }
    }

    private static Stream<String> switchEnds(Switch candidate) {
        return Stream.of(candidate.nodeA(), candidate.nodeB());
    }

    private static Set<String> requireUnique(Stream<String> values, String description) {
        return values.collect(
                        Collectors.toMap(
                                Function.identity(),
                                value -> true,
                                (first, second) -> {
                                    throw new IllegalArgumentException(
                                            "duplicate " + description + " " + first);
                                }))
                .keySet();
    }

    private static void requireKnownNodes(
            Set<String> known, Stream<String> referenced, String owner) {
        referenced
                .filter(node -> !known.contains(node))
                .findFirst()
                .ifPresent(
                        node -> {
                            throw new IllegalArgumentException(
                                    owner + " refers to unknown node " + node);
                        });
    }

    private static void requireBaysForSwitches(List<Bay> bays, List<Switch> switches) {
        Set<String> bayIds = new HashSet<>();
        bays.forEach(bay -> bayIds.add(bay.id()));
        switches.stream()
                .filter(candidate -> !bayIds.contains(candidate.bayId()))
                .findFirst()
                .ifPresent(
                        candidate -> {
                            throw new IllegalArgumentException(
                                    "switch "
                                            + candidate.id()
                                            + " refers to unknown bay "
                                            + candidate.bayId());
                        });
    }

    private static void requireOneBreakerPerBay(List<Bay> bays, List<Switch> switches) {
        for (Bay bay : bays) {
            long breakers =
                    switches.stream()
                            .filter(candidate -> candidate.bayId().equals(bay.id()))
                            .filter(candidate -> candidate.kind() == SwitchKind.BREAKER)
                            .count();
            if (breakers != 1) {
                throw new IllegalArgumentException(
                        "bay " + bay.id() + " needs exactly one breaker, found " + breakers);
            }
        }
    }
}
