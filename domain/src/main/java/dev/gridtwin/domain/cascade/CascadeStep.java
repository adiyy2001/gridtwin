package dev.gridtwin.domain.cascade;

import dev.gridtwin.domain.contingency.Outage;
import dev.gridtwin.domain.topology.Outages;
import dev.gridtwin.domain.twin.GridSolution;
import java.util.Optional;

public record CascadeStep(
        int index,
        Optional<Outage> tripped,
        Optional<Double> loadingAtTrip,
        Outages outages,
        GridSolution solution) {

    public double servedLoadMw() {
        return this.solution.totalLoadMw() - this.solution.shedLoadMw();
    }
}
