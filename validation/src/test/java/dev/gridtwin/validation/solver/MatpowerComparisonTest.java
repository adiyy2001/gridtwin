package dev.gridtwin.validation.solver;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import dev.gridtwin.cases.CaseLoader;
import dev.gridtwin.domain.model.Network;
import dev.gridtwin.domain.powerflow.BranchResult;
import dev.gridtwin.domain.powerflow.BusResult;
import dev.gridtwin.domain.powerflow.EjmlSparseLuSolver;
import dev.gridtwin.domain.powerflow.GeneratorResult;
import dev.gridtwin.domain.powerflow.PowerFlow;
import dev.gridtwin.domain.powerflow.PowerFlowOptions;
import dev.gridtwin.domain.powerflow.PowerFlowResult;
import dev.gridtwin.domain.powerflow.ReactiveLimitState;
import dev.gridtwin.validation.reference.ReferenceSolution;
import dev.gridtwin.validation.reference.ReferenceSolution.BranchSolution;
import dev.gridtwin.validation.reference.ReferenceSolution.BusSolution;
import dev.gridtwin.validation.reference.ReferenceSolution.GeneratorSolution;
import dev.gridtwin.validation.reference.ReferenceSolutions;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

class MatpowerComparisonTest {

    private static final double VOLTAGE_TOLERANCE_PU = 1e-6;
    private static final double ANGLE_TOLERANCE_DEGREES = 1e-4;
    private static final double FLOW_TOLERANCE_MW = 1e-4 * 100.0;
    private static final double SLACK_TOLERANCE_MW = 1e-3;

    static Stream<Arguments> referenceSets() {
        return Stream.of("ieee14", "ieee30")
                .flatMap(
                        caseId ->
                                List.of(0.5, 1.0, 1.2, 1.5).stream()
                                        .flatMap(
                                                factor ->
                                                        Stream.of(
                                                                Arguments.of(
                                                                        caseId, factor, "plain"),
                                                                Arguments.of(
                                                                        caseId, factor, "qlim"))));
    }

    @ParameterizedTest(name = "{0} at load factor {1} ({2})")
    @MethodSource("referenceSets")
    void voltagesAnglesFlowsAndGenerationMatchMatpower(
            String caseId, double loadFactor, String variant) {
        ReferenceSolution reference = ReferenceSolutions.load(caseId, loadFactor, variant);
        Network network = CaseLoader.load(caseId).network().withLoadFactor(loadFactor);
        PowerFlow powerFlow =
                new PowerFlow(
                        PowerFlowOptions.standard().withReactiveLimits(reference.enforceQLimits()),
                        EjmlSparseLuSolver::new);

        PowerFlowResult result = powerFlow.solve(network);

        assertThat(result.converged()).isTrue();
        assertThat(result.finalMismatch()).isLessThanOrEqualTo(1e-8);
        compareBuses(reference, result);
        compareBranches(reference, result);
        compareGenerators(reference, result);
        assertThat(result.totalLossMw())
                .isCloseTo(reference.totalLossMw(), within(SLACK_TOLERANCE_MW));
        assertThat(result.totalLoadMw()).isCloseTo(reference.totalLoadMw(), within(1e-9));
    }

    @Test
    void theSlackOutputOfIeee14AtBaseLoadMatchesMatpower() {
        ReferenceSolution reference = ReferenceSolutions.load("ieee14", 1.0, "plain");
        PowerFlowResult result = PowerFlow.standard().solve(CaseLoader.load("ieee14").network());

        assertThat(result.slackActiveMw())
                .isCloseTo(reference.generators().get(0).pMw(), within(SLACK_TOLERANCE_MW));
        assertThat(result.slackReactiveMvar())
                .isCloseTo(reference.generators().get(0).qMvar(), within(SLACK_TOLERANCE_MW));
    }

    private static void compareBuses(ReferenceSolution reference, PowerFlowResult result) {
        for (BusSolution expected : reference.buses()) {
            BusResult actual = result.bus(expected.number()).orElseThrow();
            assertThat(actual.voltageMagnitude())
                    .as("voltage at bus %d", expected.number())
                    .isCloseTo(expected.vm(), within(VOLTAGE_TOLERANCE_PU));
            assertThat(actual.angleDegrees())
                    .as("angle at bus %d", expected.number())
                    .isCloseTo(expected.vaDegrees(), within(ANGLE_TOLERANCE_DEGREES));
        }
    }

    private static void compareBranches(ReferenceSolution reference, PowerFlowResult result) {
        for (BranchSolution expected : reference.branches()) {
            BranchResult actual = result.branch(expected.id()).orElseThrow();
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
    }

    private static void compareGenerators(ReferenceSolution reference, PowerFlowResult result) {
        for (int position = 0; position < reference.generators().size(); position++) {
            GeneratorSolution expected = reference.generators().get(position);
            GeneratorResult actual = result.generators().get(position);
            assertThat(actual.activeMw())
                    .as("P of generator at bus %d", expected.bus())
                    .isCloseTo(expected.pMw(), within(SLACK_TOLERANCE_MW));
            assertThat(actual.reactiveMvar())
                    .as("Q of generator at bus %d", expected.bus())
                    .isCloseTo(expected.qMvar(), within(SLACK_TOLERANCE_MW));
            assertThat(actual.reactiveLimit())
                    .as("limit state of generator at bus %d", expected.bus())
                    .isEqualTo(ReactiveLimitState.valueOf(expected.qLimit()));
        }
    }
}
