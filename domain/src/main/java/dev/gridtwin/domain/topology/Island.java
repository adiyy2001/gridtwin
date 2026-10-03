package dev.gridtwin.domain.topology;

import dev.gridtwin.domain.model.Network;
import java.util.List;
import java.util.Optional;

public record Island(
        String id, List<Integer> buses, Optional<Slack> slack, Optional<Network> network) {

    public Island {
        buses = List.copyOf(buses);
        if (slack.isPresent() != network.isPresent()) {
            throw new IllegalArgumentException(
                    "island " + id + " has a slack exactly when it has a network");
        }
    }

    public boolean energized() {
        return this.slack.isPresent();
    }

    public boolean contains(int busNumber) {
        return this.buses.contains(busNumber);
    }
}
