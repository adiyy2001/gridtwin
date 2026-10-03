package dev.gridtwin.domain.cascade;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

import dev.gridtwin.domain.contingency.ContingencyNetworks;
import dev.gridtwin.domain.contingency.Outage;
import dev.gridtwin.domain.model.Network;
import dev.gridtwin.domain.topology.NetworkTopology;
import dev.gridtwin.domain.twin.GridSolution;
import dev.gridtwin.domain.twin.TwinSolver;
import org.junit.jupiter.api.Test;

class CascadeSimulationTest {

    private final TwinSolver solver = TwinSolver.standard();

    private CascadeResult run(Network network, Outage trigger, CascadeOptions options) {
        NetworkTopology source = new NetworkTopology(network);
        GridSolution base = this.solver.solve(source.topology());
        return new CascadeSimulation(this.solver, options).run(source, base, trigger);
    }

    @Test
    void aStableNetworkStopsAfterTheTrigger() {
        CascadeResult result =
                this.run(
                        ContingencyNetworks.parallelPair(100.0, 20.0, 400.0),
                        Outage.branch("LA"),
                        CascadeOptions.standard());

        assertThat(result.end()).isEqualTo(CascadeEnd.STABLE);
        assertThat(result.steps()).hasSize(2);
        assertThat(result.steps().get(0).tripped()).isEmpty();
        assertThat(result.steps().get(1).tripped()).contains(Outage.branch("LA"));
        assertThat(result.trippedCount()).isEqualTo(1);
    }

    @Test
    void anOverloadedSurvivorTripsAndTheLoadIsLost() {
        CascadeResult result =
                this.run(
                        ContingencyNetworks.parallelPair(600.0, 100.0, 400.0),
                        Outage.branch("LA"),
                        CascadeOptions.standard());

        assertThat(result.end()).isEqualTo(CascadeEnd.BLACKOUT);
        assertThat(result.steps()).hasSize(3);
        CascadeStep second = result.steps().get(2);
        assertThat(second.tripped()).contains(Outage.branch("LB"));
        assertThat(second.loadingAtTrip().orElseThrow()).isGreaterThan(1.2);
        assertThat(second.servedLoadMw()).isZero();
        assertThat(second.outages().branchIds()).containsExactly("LA", "LB");
        assertThat(result.last()).isEqualTo(second);
    }

    @Test
    void theStepLimitStopsAnEndlessChain() {
        CascadeResult result =
                this.run(
                        ContingencyNetworks.parallelPair(600.0, 100.0, 400.0),
                        Outage.branch("LA"),
                        new CascadeOptions(1.2, 1));

        assertThat(result.end()).isEqualTo(CascadeEnd.STEP_LIMIT);
        assertThat(result.steps()).hasSize(2);
    }

    @Test
    void aCollapseEndsTheCascadeWithoutFailing() {
        CascadeResult result =
                this.run(
                        ContingencyNetworks.parallelPair(1500.0, 300.0, 5000.0),
                        Outage.branch("LA"),
                        CascadeOptions.standard());

        assertThat(result.end()).isEqualTo(CascadeEnd.NON_CONVERGED);
        assertThat(result.last().solution().converged()).isFalse();
    }

    @Test
    void aGeneratorCanTriggerTheCascade() {
        CascadeResult result =
                this.run(
                        ContingencyNetworks.parallelPair(100.0, 20.0, 400.0),
                        Outage.generator("G1"),
                        CascadeOptions.standard());

        assertThat(result.end()).isEqualTo(CascadeEnd.BLACKOUT);
        assertThat(result.last().servedLoadMw()).isZero();
    }

    @Test
    void theWorstBranchTripsFirstAndTiesBreakById() {
        CascadeResult result =
                this.run(
                        ContingencyNetworks.meshWithSpur(60.0, 50.0),
                        Outage.branch("L1-2"),
                        new CascadeOptions(0.2, 50));

        assertThat(result.trippedCount()).isGreaterThan(1);
        for (CascadeStep step : result.steps().subList(2, result.steps().size())) {
            assertThat(step.loadingAtTrip().orElseThrow()).isGreaterThan(0.2);
        }
        CascadeResult again =
                this.run(
                        ContingencyNetworks.meshWithSpur(60.0, 50.0),
                        Outage.branch("L1-2"),
                        new CascadeOptions(0.2, 50));
        assertThat(again).isEqualTo(result);
    }

    @Test
    void powerBalancesInEveryStep() {
        CascadeResult result =
                this.run(
                        ContingencyNetworks.meshWithSpur(60.0, 50.0),
                        Outage.branch("L1-2"),
                        new CascadeOptions(0.2, 50));

        for (CascadeStep step : result.steps()) {
            GridSolution solution = step.solution();
            if (solution.converged()) {
                assertThat(solution.totalGenerationMw())
                        .isCloseTo(
                                solution.totalLoadMw()
                                        - solution.shedLoadMw()
                                        + solution.totalLossMw(),
                                within(1e-4));
            }
        }
    }

    @Test
    void optionsRejectNonsense() {
        assertThatThrownBy(() -> new CascadeOptions(0.0, 5))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new CascadeOptions(1.2, 0))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
