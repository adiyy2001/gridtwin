package dev.gridtwin.validation.topology;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import dev.gridtwin.domain.powerflow.BranchResult;
import dev.gridtwin.domain.powerflow.BusResult;
import dev.gridtwin.domain.powerflow.GeneratorResult;
import dev.gridtwin.domain.topology.NodeSet;
import dev.gridtwin.domain.topology.OperationResult;
import dev.gridtwin.domain.topology.Position;
import dev.gridtwin.domain.topology.Refusal;
import dev.gridtwin.domain.topology.Substation;
import dev.gridtwin.domain.topology.Switch;
import dev.gridtwin.domain.topology.SwitchKind;
import dev.gridtwin.domain.twin.GridModel;
import dev.gridtwin.domain.twin.IslandSolution;
import dev.gridtwin.domain.twin.IslandState;
import dev.gridtwin.domain.twin.Twin;
import dev.gridtwin.domain.twin.TwinSolution;
import dev.gridtwin.domain.twin.TwinSolver;
import dev.gridtwin.validation.property.Discard;
import dev.gridtwin.validation.property.Property;
import dev.gridtwin.validation.property.Shrinkers;
import java.util.List;
import org.junit.jupiter.api.Test;

class SwitchingPropertiesTest {

    private static final double ROUNDTRIP_TOLERANCE = 1e-9;
    private static final double BALANCE_TOLERANCE_MW = 1e-6 * 100.0;

    private static final GridModel MODEL = Ieee14Grid.model();
    private static final Substation SUBSTATION = MODEL.substation();

    private static Twin replay(Twin start, List<SwitchingStep> steps) {
        Twin twin = start;
        for (SwitchingStep step : steps) {
            twin = apply(twin, step);
        }
        return twin;
    }

    private static Twin apply(Twin twin, SwitchingStep step) {
        return switch (step) {
            case SwitchingStep.Operate operate ->
                    twin.operate(operate.switchId(), operate.position()).twin();
            case SwitchingStep.ScaleLoad scale -> twin.withLoadFactor(scale.factor());
        };
    }

    private static void assertFinite(TwinSolution solution) {
        for (BusResult bus : solution.buses()) {
            assertThat(bus.voltageMagnitude()).isFinite();
            assertThat(bus.angleDegrees()).isFinite();
            assertThat(bus.activeGenerationMw()).isFinite();
            assertThat(bus.activeLoadMw()).isFinite();
        }
        for (BranchResult branch : solution.branches()) {
            assertThat(branch.activeFromMw()).isFinite();
            assertThat(branch.reactiveToMvar()).isFinite();
            assertThat(branch.loading()).isFinite();
        }
        for (GeneratorResult generator : solution.generators()) {
            assertThat(generator.activeMw()).isFinite();
            assertThat(generator.reactiveMvar()).isFinite();
        }
        assertThat(solution.totalLossMw()).isFinite();
        assertThat(solution.shedLoadMw()).isFinite();
    }

    private static void assertEveryIslandIsEnergizedWithASlackOrFullyDark(TwinSolution solution) {
        for (IslandSolution island : solution.islands()) {
            if (island.island().energized()) {
                assertThat(island.island().slack()).isPresent();
                assertThat(island.state()).isIn(IslandState.ENERGIZED, IslandState.COLLAPSED);
                assertThat(island.result()).isPresent();
            } else {
                assertThat(island.state()).isEqualTo(IslandState.DEENERGIZED);
                for (int number : island.island().buses()) {
                    BusResult bus = solution.bus(number).orElseThrow();
                    assertThat(bus.voltageMagnitude()).isZero();
                    assertThat(bus.activeGenerationMw()).isZero();
                }
            }
        }
        for (BranchResult branch : solution.branches()) {
            if (!branch.energized()) {
                assertThat(branch.activeFromMw()).isZero();
                assertThat(branch.loading()).isZero();
            }
        }
    }

    private static void assertBalanceWhenConverged(TwinSolution solution) {
        if (!solution.converged()) {
            return;
        }
        double dissipated = solution.totalLoadMw() - solution.shedLoadMw() + solution.totalLossMw();
        assertThat(solution.totalGenerationMw())
                .isCloseTo(dissipated, within(BALANCE_TOLERANCE_MW));
    }

    private static void assertNoClosedEarthingSwitchOnALiveSection(TwinSolution solution) {
        for (Switch candidate : SUBSTATION.switches()) {
            if (candidate.kind() == SwitchKind.EARTHING_SWITCH
                    && solution.state().positions().isClosed(candidate.id())) {
                NodeSet section = solution.topology().nodeSetOf(candidate.nodeA());
                assertThat(section.earthed()).isTrue();
                assertThat(section.live())
                        .as("section of closed earthing switch %s", candidate.id())
                        .isFalse();
            }
        }
    }

    @Test
    void randomSwitchingSequencesNeverThrowNeverProduceNaNAndLeaveConsistentIslands() {
        Property.forAll(
                        "random switching sequences",
                        random -> SwitchingSequences.generate(random, SUBSTATION),
                        steps -> {
                            Twin twin = Twin.start(TwinSolver.standard(), MODEL);
                            for (SwitchingStep step : steps) {
                                twin = apply(twin, step);
                                TwinSolution solution = twin.solution();
                                assertFinite(solution);
                                assertEveryIslandIsEnergizedWithASlackOrFullyDark(solution);
                                assertBalanceWhenConverged(solution);
                                assertNoClosedEarthingSwitchOnALiveSection(solution);
                            }
                        })
                .shrinkingWith(Shrinkers.list())
                .run();
    }

    @Test
    void everyRefusalCarriesACodeAndAMessageAndLeavesTheTwinUntouched() {
        Property.forAll(
                        "refusals",
                        random -> SwitchingSequences.generate(random, SUBSTATION),
                        steps -> {
                            Twin twin = Twin.start(TwinSolver.standard(), MODEL);
                            for (SwitchingStep step : steps) {
                                if (step instanceof SwitchingStep.Operate operate) {
                                    Twin.Step result =
                                            twin.operate(operate.switchId(), operate.position());
                                    if (result.result()
                                            instanceof OperationResult.Refused refused) {
                                        Refusal refusal = refused.refusal();
                                        assertThat(refusal.code()).isNotBlank();
                                        assertThat(refusal.message()).isNotBlank();
                                        assertThat(refusal.switchId())
                                                .isEqualTo(operate.switchId());
                                        assertThat(result.twin()).isSameAs(twin);
                                    }
                                    twin = result.twin();
                                } else {
                                    twin = apply(twin, step);
                                }
                            }
                        })
                .shrinkingWith(Shrinkers.list())
                .run();
    }

    @Test
    void openingAndClosingABreakerReturnsTheOriginalSolution() {
        Property.forAll(
                        "breaker open and close",
                        random ->
                                new BreakerRoundtrip(
                                        SwitchingSequences.generate(random, SUBSTATION),
                                        breakers().get(random.nextInt(breakers().size()))),
                        roundtrip -> {
                            Twin before =
                                    replay(
                                            Twin.start(TwinSolver.standard(), MODEL),
                                            roundtrip.prefix());
                            Discard.unless(
                                    before.solution().converged(), "the start state collapsed");
                            Discard.unless(
                                    before.state().positions().isClosed(roundtrip.breakerId()),
                                    "the breaker is already open");
                            Twin.Step opened = before.operate(roundtrip.breakerId(), Position.OPEN);
                            Discard.unless(
                                    opened.result().accepted(), "the breaker could not open");
                            Discard.unless(
                                    opened.twin().solution().converged(),
                                    "the open state collapsed");
                            Twin.Step closed =
                                    opened.twin().operate(roundtrip.breakerId(), Position.CLOSED);
                            Discard.unless(
                                    closed.result().accepted(), "the breaker could not close");

                            assertSameSolution(before.solution(), closed.twin().solution());
                        })
                .run();
    }

    @Test
    void openingAndClosingEachBreakerOfTheInitialArrangementReturnsTheOriginalSolution() {
        Twin start = Twin.start(TwinSolver.standard(), MODEL);
        for (String breaker : breakers()) {
            Twin opened = start.operate(breaker, Position.OPEN).twin();
            Twin closed = opened.operate(breaker, Position.CLOSED).twin();

            assertSameSolution(start.solution(), closed.solution());
        }
    }

    private static List<String> breakers() {
        return SUBSTATION.switches().stream()
                .filter(candidate -> candidate.kind() == SwitchKind.BREAKER)
                .map(Switch::id)
                .toList();
    }

    private static void assertSameSolution(TwinSolution expected, TwinSolution actual) {
        for (BusResult bus : expected.buses()) {
            BusResult other = actual.bus(bus.number()).orElseThrow();
            assertThat(other.voltageMagnitude())
                    .as("voltage at bus %d", bus.number())
                    .isCloseTo(bus.voltageMagnitude(), within(ROUNDTRIP_TOLERANCE));
            assertThat(Math.toRadians(other.angleDegrees()))
                    .as("angle at bus %d", bus.number())
                    .isCloseTo(Math.toRadians(bus.angleDegrees()), within(ROUNDTRIP_TOLERANCE));
        }
    }

    private record BreakerRoundtrip(List<SwitchingStep> prefix, String breakerId) {}
}
