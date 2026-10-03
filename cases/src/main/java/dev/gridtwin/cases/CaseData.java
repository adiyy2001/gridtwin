package dev.gridtwin.cases;

import dev.gridtwin.domain.model.Network;
import java.util.List;
import java.util.Optional;

public record CaseData(
        String id, String title, Provenance provenance, Network network, List<BusPosition> layout) {

    public CaseData {
        layout = List.copyOf(layout);
    }

    public Optional<BusPosition> positionOf(int bus) {
        return this.layout.stream().filter(position -> position.bus() == bus).findFirst();
    }
}
