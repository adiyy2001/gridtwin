package dev.gridtwin.validation.contingency;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import dev.gridtwin.cases.CaseLoader;
import dev.gridtwin.domain.cascade.CascadeEnd;
import dev.gridtwin.domain.cascade.CascadeOptions;
import dev.gridtwin.domain.cascade.CascadeResult;
import dev.gridtwin.domain.cascade.CascadeSimulation;
import dev.gridtwin.domain.cascade.CascadeStep;
import dev.gridtwin.domain.contingency.Outage;
import dev.gridtwin.domain.powerflow.PowerFlowResult;
import dev.gridtwin.domain.topology.NetworkTopology;
import dev.gridtwin.domain.topology.TopologySource;
import dev.gridtwin.domain.twin.GridSolution;
import dev.gridtwin.domain.twin.IslandSolution;
import dev.gridtwin.domain.twin.IslandState;
import dev.gridtwin.domain.twin.TwinSolver;
import dev.gridtwin.domain.twin.TwinState;
import java.util.List;
import org.junit.jupiter.api.Test;

class CascadeOnIeee14Test {

    private static final double BALANCE_TOLERANCE_MW = 1e-6 * 100.0;

    private final TwinSolver solver = TwinSolver.standard();
    private final CascadeSimulation simulation = CascadeSimulation.standard();

    private CascadeResult run(double loadFactor, Outage trigger) {
        NetworkTopology source =
                new NetworkTopology(CaseLoader.load("ieee14").network().withLoadFactor(loadFactor));
        return this.simulation.run(source, this.solver.solve(source.topology()), trigger);
    }

    private static List<String> tripped(CascadeResult result) {
        return result.steps().stream()
                .flatMap(step -> step.tripped().stream())
                .map(Outage::id)
                .toList();
    }

    @Test
    void ieee14AtBaseLoadTrippingLine2To4CascadesThroughThreeFurtherBranches() {
        CascadeResult result = this.run(1.0, Outage.branch("L2-4"));

        assertThat(tripped(result))
                .containsExactly("branch:L2-4", "branch:L4-5", "branch:L6-11", "branch:L13-14");
        assertThat(result.steps()).hasSize(5);
        assertThat(result.end()).isEqualTo(CascadeEnd.NON_CONVERGED);
        assertThat(result.last().solution().converged()).isFalse();
    }

    @Test
    void ieee14At120PercentLoadTrippingLine6To12SettlesAfterTwoFurtherTrips() {
        CascadeResult result = this.run(1.2, Outage.branch("L6-12"));

        assertThat(tripped(result)).containsExactly("branch:L6-12", "branch:L6-13", "branch:L9-14");
        assertThat(result.end()).isEqualTo(CascadeEnd.STABLE);
        assertThat(result.last().solution().maxLoading()).isLessThanOrEqualTo(1.2);
    }

    @Test
    void theBaseStateComesFirstAndEveryLaterStepTripsExactlyOneBranchMore() {
        CascadeResult result = this.run(1.0, Outage.branch("L2-4"));

        assertThat(result.steps().get(0).tripped()).isEmpty();
        assertThat(result.steps().get(0).solution().maxLoading()).isLessThan(1.0);
        for (int index = 1; index < result.steps().size(); index++) {
            CascadeStep step = result.steps().get(index);
            assertThat(step.index()).isEqualTo(index);
            assertThat(step.tripped()).isPresent();
            assertThat(step.outages().size()).isEqualTo(index);
            if (index > 1) {
                assertThat(step.loadingAtTrip().orElseThrow()).isGreaterThan(1.2);
            }
        }
        assertThat(result.steps().stream().map(CascadeStep::solution)).doesNotContainNull();
    }

    @Test
    void theTrippedBranchIsTheMostLoadedOneAboveTheThreshold() {
        CascadeResult result = this.run(1.0, Outage.branch("L2-4"));

        for (int index = 2; index < result.steps().size(); index++) {
            GridSolution before = result.steps().get(index - 1).solution();
            CascadeStep step = result.steps().get(index);
            double worst =
                    before.branches().stream()
                            .mapToDouble(branch -> branch.loading())
                            .max()
                            .orElseThrow();
            assertThat(step.loadingAtTrip().orElseThrow()).isCloseTo(worst, within(1e-12));
        }
    }

    @Test
    void powerBalancesInEveryConvergedIslandOfEveryStep() {
        CascadeResult result = this.run(1.0, Outage.branch("L2-4"));

        for (CascadeStep step : result.steps()) {
            for (IslandSolution island : step.solution().islands()) {
                if (island.state() == IslandState.ENERGIZED) {
                    PowerFlowResult flow = island.result().orElseThrow();
                    assertThat(flow.totalGenerationMw())
                            .isCloseTo(
                                    flow.totalLoadMw()
                                            + flow.totalLossMw()
                                            + flow.shuntConsumptionMw(),
                                    within(BALANCE_TOLERANCE_MW));
                }
            }
        }
    }

    @Test
    void theSameTriggerAlwaysGivesTheSameCascade() {
        assertThat(this.run(1.0, Outage.branch("L2-4")))
                .isEqualTo(this.run(1.0, Outage.branch("L2-4")));
    }

    @Test
    void theCascadeAlsoRunsOnTheSubstationTwin() {
        TwinState state = CaseLoader.load("ieee14").gridModel().orElseThrow().initialState();
        TopologySource source = state;
        CascadeResult viaTwin =
                this.simulation.run(source, this.solver.solve(state).grid(), Outage.branch("L2-4"));

        assertThat(tripped(viaTwin)).isEqualTo(tripped(this.run(1.0, Outage.branch("L2-4"))));
        assertThat(viaTwin.end()).isEqualTo(CascadeEnd.NON_CONVERGED);
    }

    @Test
    void aHigherThresholdTripsFewerBranches() {
        NetworkTopology source = new NetworkTopology(CaseLoader.load("ieee14").network());
        GridSolution base = this.solver.solve(source.topology());

        CascadeResult strict =
                new CascadeSimulation(this.solver, new CascadeOptions(1.2, 50))
                        .run(source, base, Outage.branch("L2-4"));
        CascadeResult lenient =
                new CascadeSimulation(this.solver, new CascadeOptions(2.0, 50))
                        .run(source, base, Outage.branch("L2-4"));

        assertThat(lenient.trippedCount()).isLessThan(strict.trippedCount());
        assertThat(lenient.end()).isEqualTo(CascadeEnd.STABLE);
    }

    @Test
    void aVeryLowThresholdEndsInACollapseOrABlackoutWithoutFailing() {
        NetworkTopology source = new NetworkTopology(CaseLoader.load("ieee14").network());
        GridSolution base = this.solver.solve(source.topology());
        CascadeResult result =
                new CascadeSimulation(this.solver, new CascadeOptions(0.05, 50))
                        .run(source, base, Outage.branch("L2-4"));

        assertThat(result.end()).isIn(CascadeEnd.BLACKOUT, CascadeEnd.NON_CONVERGED);
        assertThat(result.steps().size()).isGreaterThan(3);
        assertThat(result.last().servedLoadMw()).isLessThan(base.totalLoadMw());
    }
}
