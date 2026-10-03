package dev.gridtwin.domain.cascade;

import dev.gridtwin.domain.contingency.Outage;
import dev.gridtwin.domain.powerflow.BranchResult;
import dev.gridtwin.domain.topology.Outages;
import dev.gridtwin.domain.topology.TopologySource;
import dev.gridtwin.domain.twin.GridSolution;
import dev.gridtwin.domain.twin.IslandSolution;
import dev.gridtwin.domain.twin.IslandState;
import dev.gridtwin.domain.twin.TwinSolver;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

public final class CascadeSimulation {

    private static final double NEGLIGIBLE_MW = 1e-6;

    private static final Comparator<BranchResult> WORST_FIRST =
            Comparator.comparingDouble(BranchResult::loading)
                    .reversed()
                    .thenComparing(BranchResult::id);

    private final TwinSolver solver;
    private final CascadeOptions options;

    public CascadeSimulation(TwinSolver solver, CascadeOptions options) {
        this.solver = solver;
        this.options = options;
    }

    public static CascadeSimulation standard() {
        return new CascadeSimulation(TwinSolver.standard(), CascadeOptions.standard());
    }

    public CascadeResult run(TopologySource source, GridSolution base, Outage trigger) {
        List<CascadeStep> steps = new ArrayList<>();
        steps.add(new CascadeStep(0, Optional.empty(), Optional.empty(), Outages.none(), base));
        CascadeStep current = this.apply(source, steps.get(0), trigger, Optional.empty());
        steps.add(current);
        while (true) {
            Optional<CascadeEnd> end = this.endOf(current, steps.size() - 1);
            if (end.isPresent()) {
                return new CascadeResult(this.options.tripThreshold(), steps, end.get());
            }
            BranchResult worst = this.worstOverloaded(current.solution()).orElseThrow();
            current =
                    this.apply(
                            source,
                            current,
                            Outage.branch(worst.id()),
                            Optional.of(worst.loading()));
            steps.add(current);
        }
    }

    private Optional<CascadeEnd> endOf(CascadeStep step, int tripsSoFar) {
        GridSolution solution = step.solution();
        if (!solution.converged()) {
            return Optional.of(CascadeEnd.NON_CONVERGED);
        }
        if (this.nothingServed(solution)) {
            return Optional.of(CascadeEnd.BLACKOUT);
        }
        if (this.worstOverloaded(solution).isEmpty()) {
            return Optional.of(CascadeEnd.STABLE);
        }
        return tripsSoFar >= this.options.maxSteps()
                ? Optional.of(CascadeEnd.STEP_LIMIT)
                : Optional.empty();
    }

    private boolean nothingServed(GridSolution solution) {
        boolean anyEnergized =
                solution.islands().stream()
                        .anyMatch(island -> island.state() == IslandState.ENERGIZED);
        return !anyEnergized || solution.totalLoadMw() - solution.shedLoadMw() <= NEGLIGIBLE_MW;
    }

    private Optional<BranchResult> worstOverloaded(GridSolution solution) {
        return solution.islands().stream()
                .filter(island -> island.state() == IslandState.ENERGIZED)
                .map(IslandSolution::result)
                .flatMap(Optional::stream)
                .flatMap(result -> result.branches().stream())
                .filter(branch -> branch.loading() > this.options.tripThreshold())
                .min(WORST_FIRST);
    }

    private CascadeStep apply(
            TopologySource source,
            CascadeStep previous,
            Outage outage,
            Optional<Double> loadingAtTrip) {
        Outages outages = outage.addTo(previous.outages());
        GridSolution solution =
                this.solver.solve(source.topology(outages), previous.solution().warmStart());
        return new CascadeStep(
                previous.index() + 1, Optional.of(outage), loadingAtTrip, outages, solution);
    }
}
