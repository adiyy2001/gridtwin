package dev.gridtwin.domain.application;

import dev.gridtwin.domain.topology.SmallStation;
import dev.gridtwin.domain.twin.GridModel;
import java.util.List;
import java.util.Optional;

final class SmallCatalog implements ModelCatalog {

    static final String ID = "small";

    @Override
    public List<String> ids() {
        return List.of(ID);
    }

    @Override
    public Optional<GridModel> find(String id) {
        return ID.equals(id)
                ? Optional.of(new GridModel(SmallStation.network(), SmallStation.substation()))
                : Optional.empty();
    }
}
