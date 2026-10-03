package dev.gridtwin.domain.application;

import dev.gridtwin.domain.twin.GridModel;
import java.util.List;
import java.util.Optional;

public interface ModelCatalog {

    List<String> ids();

    Optional<GridModel> find(String id);
}
