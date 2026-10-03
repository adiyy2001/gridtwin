package dev.gridtwin.domain.topology;

import java.util.List;
import java.util.Optional;

public record NodeSet(
        String id, List<String> nodes, Optional<Integer> busNumber, boolean earthed, boolean live) {

    public NodeSet {
        nodes = List.copyOf(nodes);
    }

    public Optional<Integer> connectedBus() {
        return this.earthed ? Optional.empty() : this.busNumber;
    }

    public NodeState state() {
        if (this.earthed) {
            return NodeState.EARTHED;
        }
        return this.live ? NodeState.ENERGIZED : NodeState.DEENERGIZED;
    }

    public boolean contains(String nodeId) {
        return this.nodes.contains(nodeId);
    }
}
