package dev.gridtwin.domain.topology;

public interface TopologySource {

    Topology topology(Outages outages);

    default Topology topology() {
        return this.topology(Outages.none());
    }
}
