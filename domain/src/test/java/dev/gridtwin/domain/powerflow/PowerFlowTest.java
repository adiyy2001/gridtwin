package dev.gridtwin.domain.powerflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

import dev.gridtwin.domain.model.Branch;
import dev.gridtwin.domain.model.Bus;
import dev.gridtwin.domain.model.BusType;
import dev.gridtwin.domain.model.Generator;
import dev.gridtwin.domain.model.Load;
import dev.gridtwin.domain.model.Network;
import dev.gridtwin.domain.model.Shunt;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class PowerFlowTest {

    private static final double REACTANCE = 0.1;
    private static final double LOAD_PU = 1.0;
    private static final double RECEIVING_VOLTAGE_SQUARED =
            (1.0 + Math.sqrt(1.0 - 4.0 * REACTANCE * REACTANCE * LOAD_PU * LOAD_PU)) / 2.0;
    private static final double RECEIVING_VOLTAGE = Math.sqrt(RECEIVING_VOLTAGE_SQUARED);
    private static final double RECEIVING_ANGLE_DEGREES =
            -Math.toDegrees(Math.asin(REACTANCE * LOAD_PU / RECEIVING_VOLTAGE));

    private final PowerFlow powerFlow = PowerFlow.standard();

    @Test
    void aLosslessLineWithAPurelyActiveLoadHasAnAnalyticSolution() {
        PowerFlowResult result =
                this.powerFlow.solve(TestNetworks.twoBus(100.0, 0.0, 0.0, REACTANCE));

        assertThat(result.converged()).isTrue();
        assertThat(result.bus(2).orElseThrow().voltageMagnitude())
                .isCloseTo(RECEIVING_VOLTAGE, within(1e-9));
        assertThat(result.bus(2).orElseThrow().angleDegrees())
                .isCloseTo(RECEIVING_ANGLE_DEGREES, within(1e-7));
        assertThat(result.slackActiveMw()).isCloseTo(100.0, within(1e-6));
        assertThat(result.totalLossMw()).isCloseTo(0.0, within(1e-6));
    }

    @Test
    void aLineWithResistanceLosesTheCurrentSquaredTimesTheResistance() {
        PowerFlowResult result = this.powerFlow.solve(TestNetworks.twoBus(50.0, 0.0, 0.05, 0.1));

        BranchResult line = result.branch("L1-2").orElseThrow();
        double sendingCurrentPu = Math.hypot(line.activeFromMw(), line.reactiveFromMvar()) / 100.0;
        double expectedLossMw = sendingCurrentPu * sendingCurrentPu * 0.05 * 100.0;
        assertThat(line.lossMw()).isCloseTo(expectedLossMw, within(0.05));
        assertThat(result.totalLossMw()).isEqualTo(line.lossMw());
        assertThat(result.totalGenerationMw())
                .isCloseTo(result.totalLoadMw() + result.totalLossMw(), within(1e-6));
    }

    @Test
    void theSolutionReportsTheMismatchOfEveryIterationAndConvergesQuadratically() {
        PowerFlowResult result = this.powerFlow.solve(TestNetworks.threeBus(1000.0));

        assertThat(result.iterations()).isBetween(2, 8);
        assertThat(result.mismatchHistory()).hasSize(result.iterations() + 1);
        assertThat(result.mismatchHistory().get(0)).isGreaterThan(1e-3);
        assertThat(result.finalMismatch()).isLessThanOrEqualTo(1e-8);
        assertThat(result.mismatchHistory().get(1)).isLessThan(result.mismatchHistory().get(0));
    }

    @Test
    void aWarmStartFromTheSolutionConvergesInNoIterationsAndReachesTheSamePoint() {
        Network network = TestNetworks.threeBus(1000.0);
        PowerFlowResult flat = this.powerFlow.solve(network);

        PowerFlowResult warm = this.powerFlow.solve(network, flat.warmStart());

        assertThat(warm.iterations()).isZero();
        for (BusResult bus : flat.buses()) {
            BusResult other = warm.bus(bus.number()).orElseThrow();
            assertThat(other.voltageMagnitude()).isCloseTo(bus.voltageMagnitude(), within(1e-9));
            assertThat(other.angleDegrees()).isCloseTo(bus.angleDegrees(), within(1e-7));
        }
    }

    @Test
    void aWarmStartFromAnotherLoadLevelNeedsFewerIterationsAndStillReachesTheFlatStartSolution() {
        Network network = TestNetworks.threeBus(1000.0);
        PowerFlowResult lighter = this.powerFlow.solve(network.withLoadFactor(0.9));
        PowerFlowResult flat = this.powerFlow.solve(network);

        PowerFlowResult warm = this.powerFlow.solve(network, lighter.warmStart());

        assertThat(warm.iterations()).isLessThanOrEqualTo(flat.iterations());
        for (BusResult bus : flat.buses()) {
            assertThat(warm.bus(bus.number()).orElseThrow().voltageMagnitude())
                    .isCloseTo(bus.voltageMagnitude(), within(1e-8));
        }
    }

    @Test
    void aWarmStartThatMissesABusFallsBackToAFlatValueForIt() {
        Network network = TestNetworks.threeBus(1000.0);
        PowerFlowResult flat = this.powerFlow.solve(network);
        WarmStart partial = new WarmStart(Map.of(3, 0.98), Map.of(3, -4.0));

        PowerFlowResult warm = this.powerFlow.solve(network, partial);

        assertThat(warm.converged()).isTrue();
        assertThat(warm.bus(3).orElseThrow().voltageMagnitude())
                .isCloseTo(flat.bus(3).orElseThrow().voltageMagnitude(), within(1e-8));
    }

    @Test
    void generationEqualsLoadPlusLossesPlusShuntConsumption() {
        Network network =
                new Network(
                        "shunt",
                        100.0,
                        List.of(
                                TestNetworks.bus(1, BusType.REFERENCE),
                                TestNetworks.bus(2, BusType.PQ)),
                        List.of(new Load(2, 40.0, 10.0)),
                        List.of(new Shunt(2, 2.0, 5.0)),
                        List.of(TestNetworks.generator("G1", 1, 0.0, -100.0, 100.0)),
                        List.of(TestNetworks.line("L1-2", 1, 2, 0.02, 0.08)));

        PowerFlowResult result = this.powerFlow.solve(network);

        assertThat(result.shuntConsumptionMw()).isGreaterThan(1.0);
        assertThat(result.totalGenerationMw())
                .isCloseTo(
                        result.totalLoadMw() + result.totalLossMw() + result.shuntConsumptionMw(),
                        within(1e-6));
    }

    @Test
    void aGeneratorBusStaysAtItsSetpointWhileItsReactivePowerIsInsideTheRange() {
        PowerFlowResult result = this.powerFlow.solve(TestNetworks.threeBus(1000.0));

        BusResult generatorBus = result.bus(2).orElseThrow();
        GeneratorResult generator = result.generator("G2").orElseThrow();
        assertThat(generatorBus.type()).isEqualTo(BusType.PV);
        assertThat(generatorBus.voltageMagnitude()).isCloseTo(1.03, within(1e-12));
        assertThat(generator.reactiveLimit()).isEqualTo(ReactiveLimitState.NONE);
        assertThat(result.reactiveLimitRounds()).isZero();
    }

    @Test
    void aGeneratorThatNeedsMoreReactivePowerThanItsLimitBecomesALoadBus() {
        Network network = TestNetworks.threeBus(1000.0);
        double unlimitedQ =
                this.powerFlow.solve(network).generator("G2").orElseThrow().reactiveMvar();
        double limit = unlimitedQ / 2.0;
        Network limited = TestNetworks.threeBus(limit);

        PowerFlowResult result = this.powerFlow.solve(limited);

        GeneratorResult generator = result.generator("G2").orElseThrow();
        assertThat(unlimitedQ).isGreaterThan(10.0);
        assertThat(generator.reactiveLimit()).isEqualTo(ReactiveLimitState.UPPER);
        assertThat(generator.reactiveMvar()).isCloseTo(limit, within(1e-9));
        assertThat(result.bus(2).orElseThrow().type()).isEqualTo(BusType.PQ);
        assertThat(result.bus(2).orElseThrow().voltageMagnitude()).isLessThan(1.03);
        assertThat(result.reactiveLimitRounds()).isEqualTo(1);
        assertThat(result.warnings()).anyMatch(warning -> warning.contains("G2"));
    }

    @Test
    void theLimitsAreIgnoredWhenTheyAreNotEnforced() {
        Network network = TestNetworks.threeBus(1.0);
        PowerFlow unconstrained =
                new PowerFlow(
                        PowerFlowOptions.standard().withReactiveLimits(false),
                        EjmlSparseLuSolver::new);

        PowerFlowResult result = unconstrained.solve(network);

        assertThat(result.generator("G2").orElseThrow().reactiveMvar()).isGreaterThan(1.0);
        assertThat(result.bus(2).orElseThrow().voltageMagnitude()).isCloseTo(1.03, within(1e-12));
        assertThat(result.reactiveLimitRounds()).isZero();
    }

    @Test
    void aGeneratorThatMustAbsorbMoreThanItsLowerLimitIsPinnedThere() {
        Network network =
                new Network(
                        "absorbing",
                        100.0,
                        List.of(
                                TestNetworks.bus(1, BusType.REFERENCE),
                                TestNetworks.bus(2, BusType.PV)),
                        List.of(),
                        List.of(),
                        List.of(
                                TestNetworks.generator("G1", 1, 0.0, -500.0, 500.0),
                                new Generator(
                                        "G2", 2, 10.0, 0.0, -1.0, 50.0, 0.0, 100.0, 0.95, true)),
                        List.of(new Branch("L", 1, 2, 0.01, 0.1, 0.2, 100.0, 1.0, 0.0, true)));

        PowerFlowResult result = this.powerFlow.solve(network);

        GeneratorResult generator = result.generator("G2").orElseThrow();
        assertThat(generator.reactiveLimit()).isEqualTo(ReactiveLimitState.LOWER);
        assertThat(generator.reactiveMvar()).isCloseTo(-1.0, within(1e-9));
        assertThat(result.bus(2).orElseThrow().voltageMagnitude()).isGreaterThan(0.95);
    }

    @Test
    void theReactiveLimitOfTheSlackGeneratorIsNeverEnforced() {
        Network network = TestNetworks.twoBus(100.0, 50.0, 0.0, 0.1);
        Network tight =
                new Network(
                        "tight-slack",
                        100.0,
                        network.buses(),
                        network.loads(),
                        network.shunts(),
                        List.of(TestNetworks.generator("G1", 1, 0.0, -1.0, 1.0)),
                        network.branches());

        PowerFlowResult result = this.powerFlow.solve(tight);

        assertThat(result.generator("G1").orElseThrow().reactiveLimit())
                .isEqualTo(ReactiveLimitState.NONE);
        assertThat(result.slackReactiveMvar()).isGreaterThan(50.0);
        assertThat(result.bus(1).orElseThrow().type()).isEqualTo(BusType.REFERENCE);
    }

    @Test
    void aSlackOutputOutsideTheRangeOfItsGeneratorProducesAWarning() {
        Network network = TestNetworks.twoBus(300.0, 0.0, 0.0, 0.05);
        Network small =
                new Network(
                        "small-slack",
                        100.0,
                        network.buses(),
                        network.loads(),
                        network.shunts(),
                        List.of(
                                new Generator(
                                        "G1", 1, 0.0, 0.0, -500.0, 500.0, 0.0, 100.0, 1.0, true)),
                        network.branches());

        PowerFlowResult result = this.powerFlow.solve(small);

        assertThat(result.converged()).isTrue();
        assertThat(result.warnings()).anyMatch(warning -> warning.contains("Slack generator G1"));
    }

    @Test
    void anOverloadedNetworkIsReportedAsCollapsedInsteadOfFailing() {
        PowerFlowResult result = this.powerFlow.solve(TestNetworks.twoBus(2000.0, 500.0, 0.0, 0.1));

        assertThat(result.status()).isEqualTo(PowerFlowStatus.COLLAPSED);
        assertThat(result.converged()).isFalse();
        assertThat(result.collapseReason()).isPresent();
        assertThat(result.buses()).extracting(BusResult::state).containsOnly(BusState.COLLAPSED);
        assertThat(result.branches()).noneMatch(BranchResult::energized);
        assertThat(result.mismatchHistory()).isNotEmpty();
        assertThat(result.unservedLoadMw()).isEqualTo(2000.0);
        assertThat(result.warnings()).anyMatch(warning -> warning.startsWith("Voltage collapse"));
        assertThat(result.maxLoading()).isZero();
    }

    @Test
    void anIterationLimitThatIsTooLowIsReportedAsCollapse() {
        PowerFlow impatient =
                new PowerFlow(new PowerFlowOptions(1e-12, 1, true), EjmlSparseLuSolver::new);

        PowerFlowResult result = impatient.solve(TestNetworks.threeBus(1000.0));

        assertThat(result.collapseReason()).contains(CollapseReason.ITERATION_LIMIT);
        assertThat(result.iterations()).isEqualTo(1);
    }

    @Test
    void aSingularJacobianIsReportedAsCollapse() {
        SparseLinearSolver singular = (matrix, rightHandSide) -> Optional.empty();
        PowerFlow powerFlow = new PowerFlow(PowerFlowOptions.standard(), () -> singular);

        PowerFlowResult result = powerFlow.solve(TestNetworks.threeBus(1000.0));

        assertThat(result.collapseReason()).contains(CollapseReason.SINGULAR_JACOBIAN);
        assertThat(result.buses()).extracting(BusResult::state).containsOnly(BusState.COLLAPSED);
    }

    @Test
    void aStepWithNonFiniteValuesIsReportedAsCollapse() {
        SparseLinearSolver broken =
                (matrix, rightHandSide) -> {
                    double[] step = new double[rightHandSide.length];
                    Arrays.fill(step, Double.NaN);
                    return Optional.of(step);
                };
        PowerFlow powerFlow = new PowerFlow(PowerFlowOptions.standard(), () -> broken);

        PowerFlowResult result = powerFlow.solve(TestNetworks.threeBus(1000.0));

        assertThat(result.collapseReason()).contains(CollapseReason.INVALID_VOLTAGE);
    }

    @Test
    void aStepThatDrivesAVoltageToZeroIsReportedAsCollapse() {
        SparseLinearSolver collapsing =
                (matrix, rightHandSide) -> {
                    double[] step = new double[rightHandSide.length];
                    Arrays.fill(step, -10.0);
                    return Optional.of(step);
                };
        PowerFlow powerFlow = new PowerFlow(PowerFlowOptions.standard(), () -> collapsing);

        PowerFlowResult result = powerFlow.solve(TestNetworks.twoBus(10.0, 0.0, 0.0, 0.1));

        assertThat(result.collapseReason()).contains(CollapseReason.INVALID_VOLTAGE);
    }

    @Test
    void aSolverFailureWhileTheMismatchIsNotFiniteIsReportedAsCollapse() {
        Network network =
                new Network(
                        "nan",
                        100.0,
                        List.of(
                                TestNetworks.bus(1, BusType.REFERENCE),
                                TestNetworks.bus(2, BusType.PQ)),
                        List.of(new Load(2, Double.NaN, 0.0)),
                        List.of(),
                        List.of(TestNetworks.generator("G1", 1, 0.0, -100.0, 100.0)),
                        List.of(TestNetworks.line("L1-2", 1, 2, 0.0, 0.1)));

        PowerFlowResult result = this.powerFlow.solve(network);

        assertThat(result.collapseReason()).contains(CollapseReason.INVALID_VOLTAGE);
        assertThat(result.mismatchHistory()).isEmpty();
    }

    @Test
    void busesCutOffFromTheReferenceAreDeEnergizedAndTheirLoadIsUnserved() {
        Network network =
                new Network(
                        "split",
                        100.0,
                        List.of(
                                TestNetworks.bus(1, BusType.REFERENCE),
                                TestNetworks.bus(2, BusType.PQ),
                                TestNetworks.bus(3, BusType.PQ)),
                        List.of(new Load(2, 30.0, 5.0), new Load(3, 20.0, 4.0)),
                        List.of(),
                        List.of(TestNetworks.generator("G1", 1, 0.0, -100.0, 100.0)),
                        List.of(
                                TestNetworks.line("L1-2", 1, 2, 0.01, 0.1),
                                TestNetworks.line("L2-3", 2, 3, 0.01, 0.1).withInService(false)));

        PowerFlowResult result = this.powerFlow.solve(network);

        assertThat(result.converged()).isTrue();
        assertThat(result.bus(3).orElseThrow().state()).isEqualTo(BusState.DEENERGIZED);
        assertThat(result.bus(3).orElseThrow().voltageMagnitude()).isZero();
        assertThat(result.bus(3).orElseThrow().activeLoadMw()).isEqualTo(20.0);
        assertThat(result.branch("L2-3").orElseThrow().energized()).isFalse();
        assertThat(result.unservedLoadMw()).isEqualTo(20.0);
        assertThat(result.totalLoadMw()).isEqualTo(30.0);
        assertThat(result.warnings()).anyMatch(warning -> warning.contains("not supplied"));
    }

    @Test
    void aBusMarkedIsolatedIsNotEnergizedEvenWhenABranchTouchesIt() {
        Network network =
                new Network(
                        "isolated",
                        100.0,
                        List.of(
                                TestNetworks.bus(1, BusType.REFERENCE),
                                TestNetworks.bus(2, BusType.ISOLATED)),
                        List.of(),
                        List.of(),
                        List.of(TestNetworks.generator("G1", 1, 0.0, -100.0, 100.0)),
                        List.of(TestNetworks.line("L1-2", 1, 2, 0.0, 0.1)));

        PowerFlowResult result = this.powerFlow.solve(network);

        assertThat(result.bus(2).orElseThrow().state()).isEqualTo(BusState.DEENERGIZED);
        assertThat(result.branch("L1-2").orElseThrow().energized()).isFalse();
    }

    @Test
    void aNetworkWhoseReferenceBusIsIsolatedHasNothingToSolve() {
        Network network =
                new Network(
                        "dead",
                        100.0,
                        List.of(new Bus(1, BusType.REFERENCE, 132.0, 0.9, 1.1, 1.0, 0.0)),
                        List.of(new Load(1, 10.0, 0.0)),
                        List.of(),
                        List.of(),
                        List.of());
        Network isolatedReference =
                new Network(
                        "dead",
                        100.0,
                        List.of(
                                new Bus(1, BusType.ISOLATED, 132.0, 0.9, 1.1, 1.0, 0.0),
                                new Bus(2, BusType.REFERENCE, 132.0, 0.9, 1.1, 1.0, 0.0)),
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of());

        PowerFlowResult single = this.powerFlow.solve(network);
        PowerFlowResult result = this.powerFlow.solve(isolatedReference);

        assertThat(single.converged()).isTrue();
        assertThat(single.iterations()).isZero();
        assertThat(result.converged()).isTrue();
    }

    @Test
    void currentsInKiloAmperesFollowFromApparentPowerAndBaseVoltage() {
        PowerFlowResult result = this.powerFlow.solve(TestNetworks.twoBus(100.0, 30.0, 0.01, 0.1));

        BranchResult line = result.branch("L1-2").orElseThrow();
        double expectedFrom = line.apparentFromMva() / (Math.sqrt(3.0) * 132.0 * 1.0);
        double toVoltageKv = 132.0 * result.bus(2).orElseThrow().voltageMagnitude();
        double expectedTo = line.apparentToMva() / (Math.sqrt(3.0) * toVoltageKv);
        assertThat(line.currentFromKa()).isCloseTo(expectedFrom, within(1e-9));
        assertThat(line.currentToKa()).isCloseTo(expectedTo, within(1e-9));
    }

    @Test
    void loadingIsTheLargerApparentPowerOverTheRating() {
        PowerFlowResult result = this.powerFlow.solve(TestNetworks.twoBus(100.0, 30.0, 0.01, 0.1));

        BranchResult line = result.branch("L1-2").orElseThrow();
        assertThat(line.loading()).isCloseTo(line.apparentPowerMva() / 200.0, within(1e-12));
        assertThat(line.overloaded()).isFalse();
        assertThat(result.maxLoading()).isEqualTo(line.loading());
    }

    @Test
    void aBranchOverItsRatingIsMarkedOverloaded() {
        Network network = TestNetworks.twoBus(100.0, 30.0, 0.01, 0.1);
        Network rated =
                network.withBranches(
                        List.of(network.findBranch("L1-2").orElseThrow().withRating(50.0)));

        PowerFlowResult result = this.powerFlow.solve(rated);

        assertThat(result.branch("L1-2").orElseThrow().overloaded()).isTrue();
    }

    @Test
    void aTransformerWithATapChangesTheVoltageRatioAcrossIt() {
        Network network =
                new Network(
                        "tap",
                        100.0,
                        List.of(
                                TestNetworks.bus(1, BusType.REFERENCE),
                                TestNetworks.bus(2, BusType.PQ)),
                        List.of(new Load(2, 10.0, 0.0)),
                        List.of(),
                        List.of(TestNetworks.generator("G1", 1, 0.0, -100.0, 100.0)),
                        List.of(new Branch("T", 1, 2, 0.0, 0.05, 0.0, 100.0, 1.05, 0.0, true)));

        PowerFlowResult result = this.powerFlow.solve(network);

        assertThat(result.bus(2).orElseThrow().voltageMagnitude())
                .isCloseTo(1.0 / 1.05, within(0.01));
    }

    @Test
    void aPhaseShiftMovesActivePowerWithoutAnyLoad() {
        Network network =
                new Network(
                        "shifter",
                        100.0,
                        List.of(
                                TestNetworks.bus(1, BusType.REFERENCE),
                                TestNetworks.bus(2, BusType.PQ),
                                TestNetworks.bus(3, BusType.PQ)),
                        List.of(new Load(3, 0.0, 0.0)),
                        List.of(),
                        List.of(TestNetworks.generator("G1", 1, 0.0, -100.0, 100.0)),
                        List.of(
                                new Branch("S", 1, 2, 0.0, 0.1, 0.0, 100.0, 1.0, 5.0, true),
                                TestNetworks.line("A", 2, 3, 0.0, 0.1),
                                TestNetworks.line("B", 1, 3, 0.0, 0.1)));

        PowerFlowResult result = this.powerFlow.solve(network);

        double circulatingFlow = result.branch("B").orElseThrow().activeFromMw();
        assertThat(Math.abs(circulatingFlow)).isGreaterThan(1.0);
        assertThat(result.slackActiveMw()).isCloseTo(0.0, within(1e-6));
    }

    @Test
    void twoGeneratorsOnTheReferenceBusShareTheOutputAroundTheSlackOne() {
        Network network =
                new Network(
                        "two-on-slack",
                        100.0,
                        List.of(
                                TestNetworks.bus(1, BusType.REFERENCE),
                                TestNetworks.bus(2, BusType.PQ)),
                        List.of(new Load(2, 100.0, 20.0)),
                        List.of(),
                        List.of(
                                TestNetworks.generator("G1", 1, 0.0, -50.0, 50.0),
                                TestNetworks.generator("G1b", 1, 30.0, -50.0, 150.0)),
                        List.of(TestNetworks.line("L1-2", 1, 2, 0.01, 0.1)));

        PowerFlowResult result = this.powerFlow.solve(network);

        assertThat(result.generator("G1b").orElseThrow().activeMw()).isEqualTo(30.0);
        assertThat(result.generator("G1").orElseThrow().activeMw())
                .isCloseTo(result.slackActiveMw() - 30.0, within(1e-9));
        double sharedReactive =
                result.generator("G1").orElseThrow().reactiveMvar()
                        + result.generator("G1b").orElseThrow().reactiveMvar();
        assertThat(sharedReactive).isCloseTo(result.slackReactiveMvar(), within(1e-9));
    }

    @Test
    void generatorsWithoutAReactiveRangeShareEquallyAndDisconnectedGeneratorsProduceNothing() {
        Network network =
                new Network(
                        "fixed-range",
                        100.0,
                        List.of(
                                TestNetworks.bus(1, BusType.REFERENCE),
                                TestNetworks.bus(2, BusType.PV),
                                TestNetworks.bus(3, BusType.PQ)),
                        List.of(new Load(2, 10.0, 5.0)),
                        List.of(),
                        List.of(
                                TestNetworks.generator("G1", 1, 0.0, -100.0, 100.0),
                                new Generator("G2", 2, 20.0, 0.0, 0.0, 0.0, 0.0, 50.0, 1.0, true),
                                new Generator("G2b", 2, 10.0, 0.0, 0.0, 0.0, 0.0, 50.0, 1.0, true),
                                new Generator(
                                        "G3", 3, 10.0, 0.0, 0.0, 10.0, 0.0, 50.0, 1.0, false)),
                        List.of(
                                TestNetworks.line("L1-2", 1, 2, 0.0, 0.1),
                                TestNetworks.line("L2-3", 2, 3, 0.0, 0.1)));
        PowerFlow unconstrained =
                new PowerFlow(
                        PowerFlowOptions.standard().withReactiveLimits(false),
                        EjmlSparseLuSolver::new);

        PowerFlowResult result = unconstrained.solve(network);

        assertThat(result.generator("G2").orElseThrow().reactiveMvar())
                .isCloseTo(result.generator("G2b").orElseThrow().reactiveMvar(), within(1e-12));
        assertThat(result.generator("G3").orElseThrow().activeMw()).isZero();
        assertThat(result.generator("G3").orElseThrow().inService()).isFalse();
    }

    @Test
    void aGeneratorBusWithoutAnyGeneratorInServiceIsTreatedAsALoadBus() {
        Network network = TestNetworks.threeBus(1000.0);
        Generator off = network.generators().get(1);
        Generator disabled =
                new Generator(
                        off.id(),
                        off.bus(),
                        off.activePowerMw(),
                        off.reactivePowerMvar(),
                        off.reactiveMinMvar(),
                        off.reactiveMaxMvar(),
                        off.activeMinMw(),
                        off.activeMaxMw(),
                        off.voltageSetpoint(),
                        false);
        Network without =
                new Network(
                        network.id(),
                        network.baseMva(),
                        network.buses(),
                        network.loads(),
                        network.shunts(),
                        List.of(network.generators().get(0), disabled),
                        network.branches());

        PowerFlowResult result = this.powerFlow.solve(without);

        assertThat(result.converged()).isTrue();
        assertThat(result.bus(2).orElseThrow().type()).isEqualTo(BusType.PQ);
        assertThat(result.bus(2).orElseThrow().voltageMagnitude()).isLessThan(1.03);
    }

    @Test
    void aGeneratorOnALoadBusKeepsItsTableOutput() {
        Network base = TestNetworks.twoBus(100.0, 20.0, 0.01, 0.1);
        Generator local = new Generator("G2", 2, 30.0, 5.0, -10.0, 10.0, 0.0, 50.0, 1.0, true);
        Network network =
                new Network(
                        "local",
                        100.0,
                        base.buses(),
                        base.loads(),
                        base.shunts(),
                        List.of(base.generators().get(0), local),
                        base.branches());

        PowerFlowResult result = this.powerFlow.solve(network);

        assertThat(result.generator("G2").orElseThrow().activeMw()).isEqualTo(30.0);
        assertThat(result.generator("G2").orElseThrow().reactiveMvar()).isEqualTo(5.0);
        assertThat(result.bus(2).orElseThrow().activeGenerationMw()).isCloseTo(30.0, within(1e-9));
        assertThat(result.slackActiveMw()).isCloseTo(70.0 + result.totalLossMw(), within(1e-6));
    }

    @Test
    void theStandardOptionsMatchTheBrief() {
        PowerFlowOptions options = PowerFlowOptions.standard();

        assertThat(options.tolerance()).isEqualTo(1e-8);
        assertThat(options.maxIterations()).isEqualTo(20);
        assertThat(options.enforceReactiveLimits()).isTrue();
        assertThat(this.powerFlow.options()).isEqualTo(options);
    }

    @Test
    void invalidOptionsAreRejected() {
        assertThatThrownBy(() -> new PowerFlowOptions(0.0, 20, true))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new PowerFlowOptions(1e-8, 0, true))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void theBusListOfAResultFollowsTheNetworkOrder() {
        Network network = TestNetworks.threeBus(1000.0);

        PowerFlowResult result = this.powerFlow.solve(network);

        assertThat(result.buses().stream().map(BusResult::number).toList())
                .isEqualTo(network.buses().stream().map(Bus::number).toList());
        assertThat(result.branches()).hasSameSizeAs(network.branches());
        assertThat(result.bus(99)).isEmpty();
        assertThat(result.branch("nope")).isEmpty();
        assertThat(result.generator("nope")).isEmpty();
    }
}
