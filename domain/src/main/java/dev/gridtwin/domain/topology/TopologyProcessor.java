package dev.gridtwin.domain.topology;

import dev.gridtwin.domain.model.Branch;
import dev.gridtwin.domain.model.Bus;
import dev.gridtwin.domain.model.BusType;
import dev.gridtwin.domain.model.Generator;
import dev.gridtwin.domain.model.Load;
import dev.gridtwin.domain.model.Network;
import dev.gridtwin.domain.topology.NodeGroups.Group;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class TopologyProcessor {

    private TopologyProcessor() {}

    public static Topology process(
            Network network, Substation substation, SwitchPositions positions) {
        NodeGroups groups = NodeGroups.of(substation, positions);
        List<Load> disconnectedLoads = new ArrayList<>();
        Network expanded = expand(network, substation, groups, disconnectedLoads);
        List<Island> islands = Islands.detect(expanded);
        List<NodeSet> nodeSets =
                groups.groups().stream()
                        .map(group -> group.toNodeSet(isLive(network, substation, islands, group)))
                        .toList();
        return new Topology(expanded, nodeSets, islands, disconnectedLoads);
    }

    private static Network expand(
            Network network,
            Substation substation,
            NodeGroups groups,
            List<Load> disconnectedLoads) {
        int own = substation.busNumber();
        List<Bus> buses = new ArrayList<>();
        for (Bus bus : network.buses()) {
            if (bus.number() == own) {
                groups.groups().stream()
                        .flatMap(group -> group.busNumber().stream())
                        .sorted()
                        .forEach(number -> buses.add(bus.renumbered(number, BusType.PQ)));
            } else {
                buses.add(bus);
            }
        }
        List<Branch> branches =
                network.branches().stream()
                        .map(branch -> relocate(branch, substation, groups))
                        .toList();
        List<Load> loads = new ArrayList<>();
        for (Load load : network.loads()) {
            if (load.bus() != own) {
                loads.add(load);
                continue;
            }
            Optional<Integer> bus = loadBus(substation, groups);
            if (bus.isPresent()) {
                loads.add(load.atBus(bus.get()));
            } else {
                disconnectedLoads.add(load);
            }
        }
        List<Generator> generators =
                network.generators().stream()
                        .map(generator -> relocate(generator, substation, groups))
                        .toList();
        return new Network(
                network.id(),
                network.baseMva(),
                buses,
                loads,
                network.shunts(),
                generators,
                branches);
    }

    private static Branch relocate(Branch branch, Substation substation, NodeGroups groups) {
        int own = substation.busNumber();
        Optional<Integer> from =
                branch.from() == own
                        ? terminalBus(substation, groups, TerminalKind.BRANCH, branch.id())
                        : Optional.of(branch.from());
        Optional<Integer> to =
                branch.to() == own
                        ? terminalBus(substation, groups, TerminalKind.BRANCH, branch.id())
                        : Optional.of(branch.to());
        boolean connected = from.isPresent() && to.isPresent();
        return new Branch(
                branch.id(),
                from.orElse(branch.from()),
                to.orElse(branch.to()),
                branch.resistance(),
                branch.reactance(),
                branch.chargingSusceptance(),
                branch.ratingMva(),
                branch.tap(),
                branch.shiftDegrees(),
                branch.inService() && connected);
    }

    private static Generator relocate(
            Generator generator, Substation substation, NodeGroups groups) {
        if (generator.bus() != substation.busNumber()) {
            return generator;
        }
        Optional<Integer> bus =
                terminalBus(substation, groups, TerminalKind.GENERATOR, generator.id());
        return bus.map(generator::atBus).orElseGet(() -> generator.withInService(false));
    }

    private static Optional<Integer> loadBus(Substation substation, NodeGroups groups) {
        return substation.bays().stream()
                .flatMap(bay -> bay.terminal().stream())
                .filter(terminal -> terminal.kind() == TerminalKind.LOAD)
                .findFirst()
                .flatMap(terminal -> groups.groupOf(terminal.nodeId()).connectedBus());
    }

    private static Optional<Integer> terminalBus(
            Substation substation, NodeGroups groups, TerminalKind kind, String equipmentId) {
        Terminal terminal =
                substation.bays().stream()
                        .flatMap(bay -> bay.terminal().stream())
                        .filter(
                                candidate ->
                                        candidate.kind() == kind
                                                && candidate.equipmentId().equals(equipmentId))
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "no terminal for " + kind + " " + equipmentId));
        return groups.groupOf(terminal.nodeId()).connectedBus();
    }

    private static boolean isLive(
            Network network, Substation substation, List<Island> islands, Group group) {
        Optional<Integer> bus = group.connectedBus();
        if (bus.isPresent()) {
            return islands.stream()
                    .anyMatch(island -> island.contains(bus.get()) && island.energized());
        }
        return substation.bays().stream()
                .flatMap(bay -> bay.terminal().stream())
                .filter(terminal -> group.nodes().contains(terminal.nodeId()))
                .anyMatch(terminal -> feeds(network, substation, islands, terminal));
    }

    private static boolean feeds(
            Network network, Substation substation, List<Island> islands, Terminal terminal) {
        return switch (terminal.kind()) {
            case LOAD -> false;
            case GENERATOR ->
                    network.generators().stream()
                            .anyMatch(
                                    generator ->
                                            generator.id().equals(terminal.equipmentId())
                                                    && generator.canTakeSlack());
            case BRANCH ->
                    network.findBranch(terminal.equipmentId())
                            .filter(Branch::inService)
                            .map(branch -> remoteEnd(branch, substation))
                            .map(remote -> islandEnergized(islands, remote))
                            .orElse(false);
        };
    }

    private static int remoteEnd(Branch branch, Substation substation) {
        return branch.from() == substation.busNumber() ? branch.to() : branch.from();
    }

    private static boolean islandEnergized(List<Island> islands, int busNumber) {
        return islands.stream()
                .anyMatch(island -> island.contains(busNumber) && island.energized());
    }
}
