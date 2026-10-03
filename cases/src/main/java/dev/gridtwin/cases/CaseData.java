package dev.gridtwin.cases;

import dev.gridtwin.domain.model.Network;
import dev.gridtwin.domain.topology.Substation;
import dev.gridtwin.domain.twin.GridModel;
import java.util.List;
import java.util.Optional;

public record CaseData(
        String id,
        String title,
        Provenance provenance,
        Network network,
        List<BusPosition> layout,
        Optional<Substation> substation) {

    public CaseData {
        layout = List.copyOf(layout);
    }

    public Optional<GridModel> gridModel() {
        return this.substation.map(detail -> new GridModel(this.network, detail));
    }

    public Optional<BusPosition> positionOf(int bus) {
        return this.layout.stream().filter(position -> position.bus() == bus).findFirst();
    }
}
