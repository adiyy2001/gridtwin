package dev.gridtwin.domain.topology;

import dev.gridtwin.domain.model.Load;
import dev.gridtwin.domain.model.Network;
import java.util.List;
import java.util.Optional;

public record Topology(
        Network network,
        List<NodeSet> nodeSets,
        List<Island> islands,
        List<Load> disconnectedLoads) {

    public Topology {
        nodeSets = List.copyOf(nodeSets);
        islands = List.copyOf(islands);
        disconnectedLoads = List.copyOf(disconnectedLoads);
    }

    public NodeSet nodeSetOf(String nodeId) {
        return this.nodeSets.stream()
                .filter(set -> set.contains(nodeId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("unknown node " + nodeId));
    }

    public NodeState stateOf(String nodeId) {
        return this.nodeSetOf(nodeId).state();
    }

    public Optional<Island> islandOf(int busNumber) {
        return this.islands.stream().filter(island -> island.contains(busNumber)).findFirst();
    }

    public List<Island> energizedIslands() {
        return this.islands.stream().filter(Island::energized).toList();
    }

    public double disconnectedLoadMw() {
        return this.disconnectedLoads.stream().mapToDouble(Load::activePowerMw).sum();
    }
}
