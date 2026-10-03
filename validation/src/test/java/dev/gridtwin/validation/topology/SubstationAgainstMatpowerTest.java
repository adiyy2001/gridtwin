package dev.gridtwin.validation.topology;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import dev.gridtwin.domain.powerflow.BranchResult;
import dev.gridtwin.domain.powerflow.BusResult;
import dev.gridtwin.domain.powerflow.GeneratorResult;
import dev.gridtwin.domain.topology.Position;
import dev.gridtwin.domain.topology.Substation;
import dev.gridtwin.domain.topology.SwitchKind;
import dev.gridtwin.domain.twin.Twin;
import dev.gridtwin.domain.twin.TwinSolution;
import dev.gridtwin.domain.twin.TwinSolver;
import dev.gridtwin.domain.twin.TwinState;
import dev.gridtwin.validation.reference.ReferenceSolution;
import dev.gridtwin.validation.reference.ReferenceSolution.BranchSolution;
import dev.gridtwin.validation.reference.ReferenceSolution.BusSolution;
import dev.gridtwin.validation.reference.ReferenceSolution.GeneratorSolution;
import dev.gridtwin.validation.reference.ReferenceSolutions;
import org.junit.jupiter.api.Test;

class SubstationAgainstMatpowerTest {

    private static final double VOLTAGE_TOLERANCE_PU = 1e-6;
    private static final double ANGLE_TOLERANCE_DEGREES = 1e-4;
    private static final double FLOW_TOLERANCE_MW = 1e-4 * 100.0;
    private static final double GENERATION_TOLERANCE_MW = 1e-3;

    @Test
    void theDefaultArrangementWithTheCouplerClosedEqualsTheIeee14Reference() {
        TwinSolution solution = Ieee14Grid.twinWithoutReactiveLimits().solution();

        assertMatchesReference(ReferenceSolutions.load("ieee14", 1.0, "plain"), solution);
        assertThat(solution.buses()).hasSize(14);
    }

    @Test
    void closingEveryBusDisconnectorOfEveryBayStillEqualsTheIeee14Reference() {
        Substation substation = Ieee14Grid.model().substation();
        Twin twin = Ieee14Grid.twinWithoutReactiveLimits();
        for (var candidate : substation.switches()) {
            if (candidate.kind() == SwitchKind.DISCONNECTOR && candidate.nodeA().startsWith("BB")) {
                twin = twin.operate(breakerOf(substation, candidate.bayId()), Position.OPEN).twin();
                twin = twin.operate(candidate.id(), Position.CLOSED).twin();
                twin =
                        twin.operate(breakerOf(substation, candidate.bayId()), Position.CLOSED)
                                .twin();
            }
        }

        assertMatchesReference(ReferenceSolutions.load("ieee14", 1.0, "plain"), twin.solution());
    }

    @Test
    void theCouplerOpenEqualsTheMatpowerSplitReference() {
        Twin twin = Ieee14Grid.openCoupler(Ieee14Grid.twinWithoutReactiveLimits());

        TwinSolution solution = twin.solution();

        assertThat(solution.topology().islands()).hasSize(1);
        assertThat(solution.buses()).hasSize(15);
        assertMatchesReference(
                ReferenceSolutions.load("ieee14-substation-coupler-open.json"), solution);
    }

    @Test
    void theCouplerClosedReferenceMatchesTheBusesThatExist() {
        TwinSolution solution = Ieee14Grid.twinWithoutReactiveLimits().solution();
        ReferenceSolution reference =
                ReferenceSolutions.load("ieee14-substation-coupler-closed.json");

        BusSolution busbarTwo = reference.bus(40).orElseThrow();
        BusResult merged = solution.bus(4).orElseThrow();

        assertThat(merged.voltageMagnitude())
                .isCloseTo(busbarTwo.vm(), within(VOLTAGE_TOLERANCE_PU));
        assertThat(merged.angleDegrees())
                .isCloseTo(busbarTwo.vaDegrees(), within(ANGLE_TOLERANCE_DEGREES));
    }

    @Test
    void theDemoScenarioOverloadsExactlyLine2To4AndKeepsTheVoltagesUp() {
        Twin twin = Twin.start(TwinSolver.standard(), Ieee14Grid.model());

        Twin split = Ieee14Grid.openCoupler(twin);

        TwinSolution solution = split.solution();
        assertThat(solution.converged()).isTrue();
        assertThat(solution.overloadedBranches())
                .extracting(BranchResult::id)
                .containsExactly("L2-4");
        assertThat(solution.branch("L2-4").orElseThrow().loading()).isBetween(1.13, 1.15);
        assertThat(solution.lowestVoltage().orElseThrow()).isGreaterThanOrEqualTo(0.95);
        assertThat(solution.shedLoadMw()).isZero();
    }

    @Test
    void theBaseSolutionOfTheStandardSolverHasNoOverload() {
        TwinState initial = Ieee14Grid.model().initialState();

        TwinSolution solution = TwinSolver.standard().solve(initial);

        assertThat(solution.converged()).isTrue();
        assertThat(solution.overloadedBranches()).isEmpty();
        assertThat(solution.maxLoading()).isLessThan(1.0);
    }

    private static String breakerOf(Substation substation, String bayId) {
        return substation.breakerOf(bayId).id();
    }

    private static void assertMatchesReference(ReferenceSolution reference, TwinSolution solution) {
        for (BusSolution expected : reference.buses()) {
            if (solution.bus(expected.number()).isEmpty()) {
                continue;
            }
            BusResult actual = solution.bus(expected.number()).orElseThrow();
            assertThat(actual.voltageMagnitude())
                    .as("voltage at bus %d", expected.number())
                    .isCloseTo(expected.vm(), within(VOLTAGE_TOLERANCE_PU));
            assertThat(actual.angleDegrees())
                    .as("angle at bus %d", expected.number())
                    .isCloseTo(expected.vaDegrees(), within(ANGLE_TOLERANCE_DEGREES));
        }
        for (BranchSolution expected : reference.branches()) {
            BranchResult actual = solution.branch(expected.id()).orElseThrow();
            assertThat(actual.activeFromMw())
                    .as("P from of %s", expected.id())
                    .isCloseTo(expected.pFromMw(), within(FLOW_TOLERANCE_MW));
            assertThat(actual.reactiveFromMvar())
                    .as("Q from of %s", expected.id())
                    .isCloseTo(expected.qFromMvar(), within(FLOW_TOLERANCE_MW));
            assertThat(actual.activeToMw())
                    .as("P to of %s", expected.id())
                    .isCloseTo(expected.pToMw(), within(FLOW_TOLERANCE_MW));
            assertThat(actual.reactiveToMvar())
                    .as("Q to of %s", expected.id())
                    .isCloseTo(expected.qToMvar(), within(FLOW_TOLERANCE_MW));
        }
        for (int position = 0; position < reference.generators().size(); position++) {
            GeneratorSolution expected = reference.generators().get(position);
            GeneratorResult actual = solution.generators().get(position);
            assertThat(actual.activeMw())
                    .as("P of generator at bus %d", expected.bus())
                    .isCloseTo(expected.pMw(), within(GENERATION_TOLERANCE_MW));
            assertThat(actual.reactiveMvar())
                    .as("Q of generator at bus %d", expected.bus())
                    .isCloseTo(expected.qMvar(), within(GENERATION_TOLERANCE_MW));
        }
        assertThat(solution.totalLossMw())
                .isCloseTo(reference.totalLossMw(), within(GENERATION_TOLERANCE_MW));
        assertThat(solution.totalLoadMw()).isCloseTo(reference.totalLoadMw(), within(1e-9));
    }
}
