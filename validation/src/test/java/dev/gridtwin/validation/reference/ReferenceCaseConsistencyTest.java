package dev.gridtwin.validation.reference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import dev.gridtwin.cases.CaseLoader;
import dev.gridtwin.domain.model.Branch;
import dev.gridtwin.domain.model.Bus;
import dev.gridtwin.domain.model.Generator;
import dev.gridtwin.domain.model.Network;
import dev.gridtwin.validation.reference.ReferenceSolution.BranchSolution;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class ReferenceCaseConsistencyTest {

    @ParameterizedTest
    @ValueSource(strings = {"ieee14", "ieee30"})
    void referenceBusesBranchesAndGeneratorsMatchTheCaseFile(String caseId) {
        Network network = CaseLoader.load(caseId).network();
        for (double factor : List.of(0.5, 1.0, 1.2, 1.5)) {
            for (String variant : List.of("plain", "qlim")) {
                ReferenceSolution solution = ReferenceSolutions.load(caseId, factor, variant);
                assertThat(solution.buses().stream().map(ReferenceSolution.BusSolution::number))
                        .containsExactlyElementsOf(
                                network.buses().stream().map(Bus::number).toList());
                assertThat(solution.branches().stream().map(BranchSolution::id))
                        .containsExactlyElementsOf(
                                network.branches().stream().map(Branch::id).toList());
                assertThat(
                                solution.generators().stream()
                                        .map(ReferenceSolution.GeneratorSolution::bus))
                        .containsExactlyElementsOf(
                                network.generators().stream().map(Generator::bus).toList());
            }
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"ieee14", "ieee30"})
    void branchEndsMatchTheCaseFile(String caseId) {
        Network network = CaseLoader.load(caseId).network();
        ReferenceSolution solution = ReferenceSolutions.load(caseId, 1.0, "plain");
        for (BranchSolution reference : solution.branches()) {
            Branch branch = network.findBranch(reference.id()).orElseThrow();
            assertThat(reference.from()).isEqualTo(branch.from());
            assertThat(reference.to()).isEqualTo(branch.to());
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"ieee14", "ieee30"})
    void theSyntheticRatingPolicyReproducesTheRatingsInTheCaseFile(String caseId) {
        Network network = CaseLoader.load(caseId).network();
        ReferenceSolution solution = ReferenceSolutions.load(caseId, 1.0, "plain");
        for (BranchSolution reference : solution.branches()) {
            double expected =
                    Math.max(Math.ceil(1.25 * reference.apparentPowerMva() / 5.0) * 5.0, 20.0);
            assertThat(network.findBranch(reference.id()).orElseThrow().ratingMva())
                    .as("rating of %s", reference.id())
                    .isEqualTo(expected);
        }
    }

    @Test
    void theCouplerClosedSubstationEqualsTheOriginalSolutionAndBusFortyFollowsBusFour() {
        ReferenceSolution base = ReferenceSolutions.load("ieee14", 1.0, "plain");
        ReferenceSolution closed = ReferenceSolutions.load("ieee14-substation-coupler-closed.json");
        assertThat(closed.buses()).hasSize(15);
        assertThat(closed.bus(40).orElseThrow().vm()).isEqualTo(closed.bus(4).orElseThrow().vm());
        assertThat(closed.bus(40).orElseThrow().vaDegrees())
                .isEqualTo(closed.bus(4).orElseThrow().vaDegrees());
        assertThat(closed.bus(4).orElseThrow().vm()).isEqualTo(base.bus(4).orElseThrow().vm());
        assertThat(closed.totalLossMw()).isEqualTo(base.totalLossMw());
    }

    @Test
    void theSubstationAssignsTheBaysToTheBusbarsAndMovesTheLoadToTheSecondOne() {
        ReferenceSolution open = ReferenceSolutions.load("ieee14-substation-coupler-open.json");
        assertThat(endsOf(open, "L3-4")).containsExactly(3, 4);
        assertThat(endsOf(open, "L4-5")).containsExactly(4, 5);
        assertThat(endsOf(open, "L2-4")).containsExactly(2, 40);
        assertThat(endsOf(open, "T4-7")).containsExactly(40, 7);
        assertThat(endsOf(open, "T4-9")).containsExactly(40, 9);
        assertThat(open.bus(4).orElseThrow().pdMw()).isZero();
        assertThat(open.bus(40).orElseThrow().pdMw()).isEqualTo(47.8);
        assertThat(open.bus(40).orElseThrow().qdMvar()).isEqualTo(-3.9);
    }

    @Test
    void openingTheCouplerOverloadsExactlyTheLineTwoToFour() {
        Network network = CaseLoader.load("ieee14").network();
        ReferenceSolution open = ReferenceSolutions.load("ieee14-substation-coupler-open.json");
        List<String> overloaded =
                open.branches().stream()
                        .filter(
                                branch ->
                                        branch.apparentPowerMva()
                                                > network.findBranch(branch.id())
                                                        .orElseThrow()
                                                        .ratingMva())
                        .map(BranchSolution::id)
                        .toList();
        assertThat(overloaded).containsExactly("L2-4");
        double loading =
                open.branch("L2-4").orElseThrow().apparentPowerMva()
                        / network.findBranch("L2-4").orElseThrow().ratingMva();
        assertThat(loading).isCloseTo(1.14, within(0.005));
    }

    private static List<Integer> endsOf(ReferenceSolution solution, String branchId) {
        BranchSolution branch = solution.branch(branchId).orElseThrow();
        return List.of(branch.from(), branch.to());
    }
}
