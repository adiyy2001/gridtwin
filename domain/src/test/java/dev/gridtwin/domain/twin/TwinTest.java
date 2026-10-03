package dev.gridtwin.domain.twin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

import dev.gridtwin.domain.model.Generator;
import dev.gridtwin.domain.model.Load;
import dev.gridtwin.domain.model.Network;
import dev.gridtwin.domain.powerflow.BusResult;
import dev.gridtwin.domain.powerflow.BusState;
import dev.gridtwin.domain.topology.OperationResult;
import dev.gridtwin.domain.topology.Position;
import dev.gridtwin.domain.topology.SmallStation;
import dev.gridtwin.domain.topology.Substation;
import java.util.List;
import org.junit.jupiter.api.Test;

class TwinTest {

    private static final double BALANCE_TOLERANCE_MW = 1e-6 * 100.0;

    private final Substation substation = SmallStation.substation();
    private final TwinSolver solver = TwinSolver.standard();

    private Twin start(Network network) {
        return Twin.start(this.solver, new GridModel(network, this.substation));
    }

    private Twin start() {
        return this.start(SmallStation.network());
    }

    private Network withLoads(List<Load> loads) {
        Network base = SmallStation.network();
        return new Network(
                "heavy",
                100.0,
                base.buses(),
                loads,
                base.shunts(),
                base.generators(),
                base.branches());
    }

    private void assertBalance(TwinSolution solution) {
        assertThat(solution.totalGenerationMw())
                .isCloseTo(
                        solution.totalLoadMw() - solution.shedLoadMw() + solution.totalLossMw(),
                        within(BALANCE_TOLERANCE_MW));
    }

    @Test
    void theInitialStateSolvesAsOneEnergizedIslandAndBalances() {
        TwinSolution solution = this.start().solution();

        assertThat(solution.converged()).isTrue();
        assertThat(solution.islands()).hasSize(1);
        assertThat(solution.buses()).hasSize(5);
        assertThat(solution.branches()).hasSize(4);
        assertThat(solution.generators()).hasSize(3);
        assertThat(solution.totalLoadMw()).isEqualTo(60.0);
        assertThat(solution.shedLoadMw()).isZero();
        assertThat(solution.warnings()).isEmpty();
        this.assertBalance(solution);
    }

    @Test
    void openingTheCouplerSolvesEachIslandWithItsOwnSlack() {
        Twin split = this.start().operate(SmallStation.COUPLER_BREAKER, Position.OPEN).twin();

        TwinSolution solution = split.solution();

        assertThat(solution.converged()).isTrue();
        assertThat(solution.islands()).hasSize(2);
        assertThat(solution.islands()).allMatch(island -> island.state() == IslandState.ENERGIZED);
        assertThat(solution.islands().get(0).slackBus()).contains(1);
        assertThat(solution.islands().get(1).slackBus()).contains(4);
        assertThat(solution.buses()).hasSize(6);
        BusResult busbarTwo = solution.bus(SmallStation.SECOND_BUSBAR_BUS).orElseThrow();
        assertThat(busbarTwo.energized()).isTrue();
        assertThat(busbarTwo.activeLoadMw()).isEqualTo(20.0);
        assertThat(solution.branch("L2-4").orElseThrow().energized()).isTrue();
        this.assertBalance(solution);
        assertThat(solution.islandOf(4).orElseThrow().island().id()).isEqualTo("I2");
        assertThat(solution.islandOf(99)).isEmpty();
    }

    @Test
    void anIslandWithoutAGeneratorIsReportedAsDeenergizedAndItsLoadIsShed() {
        Twin dark = this.start().operate("LB.QA1", Position.OPEN).twin();

        TwinSolution solution = dark.solution();

        assertThat(solution.converged()).isTrue();
        assertThat(solution.bus(3).orElseThrow().state()).isEqualTo(BusState.DEENERGIZED);
        assertThat(solution.bus(3).orElseThrow().voltageMagnitude()).isZero();
        assertThat(solution.bus(3).orElseThrow().activeLoadMw()).isEqualTo(30.0);
        assertThat(solution.branch("L3-5").orElseThrow().energized()).isFalse();
        assertThat(solution.branch("L2-3").orElseThrow().energized()).isFalse();
        assertThat(solution.shedLoadMw()).isEqualTo(40.0);
        assertThat(solution.warnings())
                .anyMatch(text -> text.contains("no generator that can take the slack role"));
        this.assertBalance(solution);
    }

    @Test
    void aLoadWhoseFeederIsOpenIsShedAndReported() {
        Twin shed = this.start().operate("LD.QA1", Position.OPEN).twin();

        TwinSolution solution = shed.solution();

        assertThat(solution.shedLoadMw()).isEqualTo(20.0);
        assertThat(solution.totalLoadMw()).isEqualTo(60.0);
        assertThat(solution.warnings())
                .anyMatch(text -> text.contains("disconnected from the busbars"));
        this.assertBalance(solution);
    }

    @Test
    void aSingleBusIslandWithAGeneratorIsSolvedOnItsOwn() {
        Twin alone = this.start().operate("LC.QA1", Position.OPEN).twin();

        TwinSolution solution = alone.solution();

        IslandSolution island = solution.islandOf(4).orElseThrow();
        assertThat(island.island().buses()).containsExactly(4);
        assertThat(island.state()).isEqualTo(IslandState.ENERGIZED);
        assertThat(solution.bus(4).orElseThrow().voltageMagnitude()).isCloseTo(1.02, within(1e-9));
        assertThat(solution.generator("G4").orElseThrow().activeMw()).isZero();
        assertThat(solution.branch("L2-4").orElseThrow().energized()).isFalse();
    }

    @Test
    void aCollapsedIslandIsReportedWhileTheOtherIslandIsStillSolved() {
        Network heavy =
                this.withLoads(
                        List.of(
                                new Load(SmallStation.STATION_BUS, 20.0, 5.0),
                                new Load(3, 9000.0, 3000.0),
                                new Load(5, 10.0, 2.0)));
        Twin split = this.start(heavy).operate(SmallStation.COUPLER_BREAKER, Position.OPEN).twin();

        TwinSolution solution = split.solution();

        assertThat(solution.converged()).isFalse();
        IslandSolution collapsed = solution.islandOf(3).orElseThrow();
        IslandSolution healthy = solution.islandOf(4).orElseThrow();
        assertThat(collapsed.state()).isEqualTo(IslandState.COLLAPSED);
        assertThat(collapsed.shedLoadMw()).isGreaterThan(9000.0);
        assertThat(healthy.state()).isEqualTo(IslandState.ENERGIZED);
        assertThat(solution.bus(3).orElseThrow().state()).isEqualTo(BusState.COLLAPSED);
        assertThat(solution.bus(4).orElseThrow().state()).isEqualTo(BusState.ENERGIZED);
        assertThat(solution.warnings()).anyMatch(text -> text.contains("Voltage collapse"));
        assertThat(solution.warmStart().magnitudes()).doesNotContainKey(3).containsKey(4);
    }

    @Test
    void aRefusedOperationLeavesTheTwinUntouched() {
        Twin twin = this.start();

        Twin.Step step = twin.operate("LA.QB1", Position.OPEN);

        assertThat(step.result()).isInstanceOf(OperationResult.Refused.class);
        assertThat(step.twin()).isSameAs(twin);
    }

    @Test
    void anOperationThatChangesNothingKeepsTheSameSolution() {
        Twin twin = this.start();

        Twin.Step step = twin.operate("LA.QA1", Position.CLOSED);

        assertThat(step.result())
                .isEqualTo(new OperationResult.Accepted("LA.QA1", Position.CLOSED, false));
        assertThat(step.twin().solution()).isSameAs(twin.solution());
    }

    @Test
    void anAcceptedOperationChangesTheStateAndSolvesAgain() {
        Twin twin = this.start();

        Twin.Step step = twin.operate("LA.QA1", Position.OPEN);

        assertThat(step.result().accepted()).isTrue();
        assertThat(step.twin().state().positions().isClosed("LA.QA1")).isFalse();
        assertThat(step.twin().solution().branch("L1-2").orElseThrow().energized()).isFalse();
        assertThat(twin.state().positions().isClosed("LA.QA1")).isTrue();
    }

    @Test
    void theLoadFactorScalesTheLoadAndIsLimitedToTheSliderRange() {
        Twin twin = this.start();

        Twin heavier = twin.withLoadFactor(1.2);

        assertThat(heavier.solution().totalLoadMw()).isCloseTo(72.0, within(1e-9));
        assertThat(heavier.solution().state().loadFactor()).isEqualTo(1.2);
        assertThatThrownBy(() -> twin.withLoadFactor(0.4))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> twin.withLoadFactor(1.6))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> twin.withLoadFactor(Double.NaN))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void aWarmStartGivesTheSameSolutionAsAFlatStart() {
        TwinSolution flat = this.start().solution();
        TwinState state = flat.state().withLoadFactor(1.1);

        TwinSolution cold = this.solver.solve(state);
        TwinSolution warm = this.solver.solve(state, flat.warmStart());

        for (BusResult bus : cold.buses()) {
            BusResult other = warm.bus(bus.number()).orElseThrow();
            assertThat(other.voltageMagnitude()).isCloseTo(bus.voltageMagnitude(), within(1e-9));
            assertThat(other.angleDegrees()).isCloseTo(bus.angleDegrees(), within(1e-7));
        }
    }

    @Test
    void withoutAnyRunningUnitNothingIsEnergizedAndAllLoadIsShed() {
        Network base = SmallStation.network();
        List<Generator> stopped =
                base.generators().stream().map(unit -> unit.withInService(false)).toList();
        Network dark =
                new Network(
                        "dark",
                        100.0,
                        base.buses(),
                        base.loads(),
                        base.shunts(),
                        stopped,
                        base.branches());

        TwinSolution solution = this.start(dark).solution();

        assertThat(solution.islands()).noneMatch(island -> island.island().energized());
        assertThat(solution.lowestVoltage()).isEmpty();
        assertThat(solution.maxLoading()).isZero();
        assertThat(solution.overloadedBranches()).isEmpty();
        assertThat(solution.shedLoadMw()).isEqualTo(60.0);
        assertThat(solution.bus(99)).isEmpty();
        assertThat(solution.branch("none")).isEmpty();
        assertThat(solution.generator("none")).isEmpty();
    }

    @Test
    void theLowestVoltageAndTheMaximumLoadingComeFromTheEnergizedPart() {
        TwinSolution solution = this.start().solution();

        assertThat(solution.lowestVoltage().orElseThrow()).isBetween(0.9, 1.1);
        assertThat(solution.maxLoading()).isGreaterThan(0.0);
    }

    @Test
    void theStandardSolverConvergesTighterThanTheBriefTolerance() {
        TwinSolution solution =
                this.start().operate(SmallStation.COUPLER_BREAKER, Position.OPEN).twin().solution();

        assertThat(solution.islands())
                .allSatisfy(
                        island ->
                                assertThat(island.result().orElseThrow().finalMismatch())
                                        .isLessThanOrEqualTo(1e-10));
    }
}
