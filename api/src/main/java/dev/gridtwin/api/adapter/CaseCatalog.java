package dev.gridtwin.api.adapter;

import dev.gridtwin.cases.CaseData;
import dev.gridtwin.cases.CaseLoader;
import dev.gridtwin.domain.application.ModelCatalog;
import dev.gridtwin.domain.twin.GridModel;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

@ApplicationScoped
public class CaseCatalog implements ModelCatalog {

    private final Map<String, CaseData> switchable;

    public CaseCatalog() {
        this.switchable =
                CaseLoader.availableIds().stream()
                        .map(CaseLoader::load)
                        .filter(data -> data.substation().isPresent())
                        .collect(Collectors.toUnmodifiableMap(CaseData::id, Function.identity()));
    }

    @Override
    public List<String> ids() {
        return this.switchable.keySet().stream().sorted().toList();
    }

    @Override
    public Optional<GridModel> find(String id) {
        return this.data(id).flatMap(CaseData::gridModel);
    }

    public Optional<CaseData> data(String id) {
        return Optional.ofNullable(this.switchable.get(id));
    }

    public List<CaseData> all() {
        return this.ids().stream().map(this.switchable::get).toList();
    }
}
