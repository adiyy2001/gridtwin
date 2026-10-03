package dev.gridtwin.validation.solver;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import dev.gridtwin.cases.CaseLoader;
import dev.gridtwin.domain.model.Branch;
import dev.gridtwin.domain.model.Network;
import dev.gridtwin.domain.powerflow.BusResult;
import dev.gridtwin.domain.powerflow.BusState;
import dev.gridtwin.domain.powerflow.EjmlSparseLuSolver;
import dev.gridtwin.domain.powerflow.PowerFlow;
import dev.gridtwin.domain.powerflow.PowerFlowOptions;
import dev.gridtwin.domain.powerflow.PowerFlowResult;
import dev.gridtwin.domain.powerflow.RatingPolicy;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class SolverBehaviourOnTestSystemsTest {

    private final PowerFlow powerFlow = PowerFlow.standard();
    private final PowerFlow withoutLimits =
            new PowerFlow(
                    PowerFlowOptions.standard().withReactiveLimits(false), EjmlSparseLuSolver::new);

    @ParameterizedTest
    @ValueSource(strings = {"ieee14", "ieee30"})
    void theRatingPolicyAppliedToTheSolvedBaseCaseReproducesTheRatingsInTheCaseFile(String caseId) {
        Network network = CaseLoader.load(caseId).network();

        Network rated = RatingPolicy.standard().applyTo(network, this.withoutLimits.solve(network));

        for (Branch branch : network.branches()) {
            assertThat(rated.findBranch(branch.id()).orElseThrow().ratingMva())
                    .as("rating of %s", branch.id())
                    .isEqualTo(branch.ratingMva());
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"ieee14", "ieee30"})
    void theBaseCaseWithoutLimitsLoadsEveryBranchToAtMostEightyPercent(String caseId) {
        PowerFlowResult result = this.withoutLimits.solve(CaseLoader.load(caseId).network());

        assertThat(result.maxLoading()).isLessThanOrEqualTo(0.8 + 1e-9);
        assertThat(result.warnings()).isEmpty();
    }

    @Test
    void theIeee30BaseCaseNamesTheGeneratorAtItsReactiveLimit() {
        PowerFlowResult result = this.powerFlow.solve(CaseLoader.load("ieee30").network());

        assertThat(result.maxLoading()).isLessThan(1.0);
        assertThat(result.warnings()).anyMatch(warning -> warning.contains("G2"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"ieee14", "ieee30"})
    void aWarmStartFromAnotherLoadFactorReachesTheFlatStartSolutionAtEveryLevel(String caseId) {
        Network network = CaseLoader.load(caseId).network();
        PowerFlowResult previous = this.powerFlow.solve(network.withLoadFactor(0.5));
        for (double factor : List.of(0.75, 1.0, 1.2, 1.5)) {
            Network scaled = network.withLoadFactor(factor);
            PowerFlowResult flat = this.powerFlow.solve(scaled);
            PowerFlowResult warm = this.powerFlow.solve(scaled, previous.warmStart());

            assertThat(warm.converged()).isTrue();
            for (BusResult bus : flat.buses()) {
                BusResult other = warm.bus(bus.number()).orElseThrow();
                assertThat(other.voltageMagnitude())
                        .isCloseTo(bus.voltageMagnitude(), within(1e-7));
                assertThat(other.angleDegrees()).isCloseTo(bus.angleDegrees(), within(1e-5));
            }
            previous = flat;
        }
    }

    @Test
    void ieee14CollapsesAtAnEightyPercentOverloadAndTheResultSaysSo() {
        Network network = CaseLoader.load("ieee14").network().withLoadFactor(1.8);

        PowerFlowResult result = this.powerFlow.solve(network);

        assertThat(result.converged()).isFalse();
        assertThat(result.collapseReason()).isPresent();
        assertThat(result.buses()).extracting(BusResult::state).containsOnly(BusState.COLLAPSED);
        assertThat(result.unservedLoadMw()).isCloseTo(network.totalLoadMw(), within(1e-9));
    }

    @Test
    void ieee30CollapsesAtAHundredAndSixtyPercentLoad() {
        PowerFlowResult result =
                this.powerFlow.solve(CaseLoader.load("ieee30").network().withLoadFactor(1.6));

        assertThat(result.converged()).isFalse();
        assertThat(result.warnings()).anyMatch(warning -> warning.startsWith("Voltage collapse"));
    }

    @Test
    void ieee30StillConvergesAtAHundredAndFiftyPercentWithAVeryLowVoltage() {
        PowerFlowResult result =
                this.powerFlow.solve(CaseLoader.load("ieee30").network().withLoadFactor(1.5));

        double lowest =
                result.buses().stream()
                        .mapToDouble(BusResult::voltageMagnitude)
                        .min()
                        .orElseThrow();
        assertThat(result.converged()).isTrue();
        assertThat(lowest).isCloseTo(0.7072, within(5e-4));
        assertThat(result.reactiveLimitRounds()).isGreaterThan(0);
    }

    @Test
    void theTotalLoadOfIeee30Is283Point4Megawatts() {
        assertThat(CaseLoader.load("ieee30").network().totalLoadMw())
                .isCloseTo(283.4, within(1e-9));
    }
}
