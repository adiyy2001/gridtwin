package dev.gridtwin.domain.topology;

import dev.gridtwin.domain.model.Network;
import java.util.List;

public record NetworkTopology(Network network) implements TopologySource {

    @Override
    public Topology topology(Outages outages) {
        Network affected = outages.applyTo(this.network);
        return new Topology(affected, List.of(), Islands.detect(affected), List.of());
    }
}
