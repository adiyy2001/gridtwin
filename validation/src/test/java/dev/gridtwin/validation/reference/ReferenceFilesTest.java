package dev.gridtwin.validation.reference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import dev.gridtwin.validation.reference.ReferenceSolution.BranchSolution;
import dev.gridtwin.validation.reference.ReferenceSolution.BusSolution;
import dev.gridtwin.validation.reference.ReferenceSolution.GeneratorSolution;
import java.util.List;
import java.util.stream.DoubleStream;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

class ReferenceFilesTest {

    static Stream<String> fileNames() {
        return ReferenceSolutions.fileNames().stream();
    }

    @Test
    void thereAreEighteenReferenceFiles() {
        assertThat(ReferenceSolutions.fileNames())
                .hasSize(18)
                .contains(
                        "ieee14-lf050-plain.json",
                        "ieee14-lf150-qlim.json",
                        "ieee30-lf100-plain.json",
                        "ieee30-lf150-qlim.json",
                        "ieee14-substation-coupler-closed.json",
                        "ieee14-substation-coupler-open.json");
    }

    @ParameterizedTest
    @MethodSource("fileNames")
    void everyFileCarriesProvenanceAndAConvergedSolution(String fileName) {
        ReferenceSolution solution = ReferenceSolutions.load(fileName);
        assertThat(solution.provenance().matpowerVersion()).isEqualTo("8.1");
        assertThat(solution.provenance().octaveVersion()).isEqualTo("11.3.0");
        assertThat(solution.provenance().dockerImage()).isEqualTo("gnuoctave/octave:11.3.0");
        assertThat(solution.provenance().matpowerArchiveSha256()).hasSize(64);
        assertThat(solution.provenance().powerFlowTolerance()).isEqualTo(1e-12);
        assertThat(solution.provenance().source()).contains("MATPOWER");
        assertThat(solution.provenance().generatedBy())
                .isEqualTo("tools/reference/generate_references.m");
        assertThat(solution.converged()).isTrue();
        assertThat(solution.iterations()).isPositive();
    }

    @ParameterizedTest
    @MethodSource("fileNames")
    void everyNumberIsFinite(String fileName) {
        ReferenceSolution solution = ReferenceSolutions.load(fileName);
        DoubleStream numbers =
                Stream.of(
                                DoubleStream.of(
                                        solution.loadFactor(),
                                        solution.baseMva(),
                                        solution.totalLoadMw(),
                                        solution.totalGenerationMw(),
                                        solution.totalLossMw()),
                                solution.buses().stream()
                                        .flatMapToDouble(
                                                bus ->
                                                        DoubleStream.of(
                                                                bus.vm(),
                                                                bus.vaDegrees(),
                                                                bus.pdMw(),
                                                                bus.qdMvar())),
                                solution.generators().stream()
                                        .flatMapToDouble(
                                                generator ->
                                                        DoubleStream.of(
                                                                generator.pMw(),
                                                                generator.qMvar())),
                                solution.branches().stream()
                                        .flatMapToDouble(
                                                branch ->
                                                        DoubleStream.of(
                                                                branch.pFromMw(),
                                                                branch.qFromMvar(),
                                                                branch.pToMw(),
                                                                branch.qToMvar())))
                        .flatMapToDouble(stream -> stream);
        assertThat(numbers.allMatch(Double::isFinite)).isTrue();
    }

    @ParameterizedTest
    @MethodSource("fileNames")
    void sizesMatchTheCase(String fileName) {
        ReferenceSolution solution = ReferenceSolutions.load(fileName);
        boolean thirty = solution.caseId().equals("ieee30");
        boolean substation = solution.caseId().equals("ieee14-substation");
        assertThat(solution.buses()).hasSize(thirty ? 30 : substation ? 15 : 14);
        assertThat(solution.branches()).hasSize(thirty ? 41 : 20);
        assertThat(solution.generators()).hasSize(thirty ? 6 : 5);
    }

    @ParameterizedTest
    @MethodSource("fileNames")
    void generationEqualsLoadPlusLossesAndLossesEqualTheBranchFlowSum(String fileName) {
        ReferenceSolution solution = ReferenceSolutions.load(fileName);
        double generation =
                solution.generators().stream().mapToDouble(GeneratorSolution::pMw).sum();
        double load = solution.buses().stream().mapToDouble(BusSolution::pdMw).sum();
        double branchLoss =
                solution.branches().stream()
                        .mapToDouble(branch -> branch.pFromMw() + branch.pToMw())
                        .sum();
        assertThat(generation).isCloseTo(solution.totalGenerationMw(), within(1e-9));
        assertThat(load).isCloseTo(solution.totalLoadMw(), within(1e-9));
        assertThat(generation - load).isCloseTo(branchLoss, within(1e-6));
        assertThat(solution.totalLossMw()).isCloseTo(branchLoss, within(1e-9));
    }

    @Test
    void ieee14BaseCaseHasTheDocumentedAnchors() {
        ReferenceSolution solution = ReferenceSolutions.load("ieee14", 1.0, "plain");
        assertThat(solution.bus(1).orElseThrow().vm()).isEqualTo(1.06);
        assertThat(solution.bus(4).orElseThrow().vm()).isCloseTo(1.0176708537, within(1e-10));
        assertThat(solution.bus(4).orElseThrow().vaDegrees())
                .isCloseTo(-10.3129010923, within(1e-9));
        assertThat(solution.bus(14).orElseThrow().vaDegrees())
                .isCloseTo(-16.033644529206, within(1e-9));
    }

    @Test
    void loadFactorsScaleTheDemand() {
        for (String caseId : List.of("ieee14", "ieee30")) {
            double base = ReferenceSolutions.load(caseId, 1.0, "plain").totalLoadMw();
            for (double factor : List.of(0.5, 1.2, 1.5)) {
                assertThat(ReferenceSolutions.load(caseId, factor, "plain").totalLoadMw())
                        .isCloseTo(base * factor, within(1e-9));
                assertThat(ReferenceSolutions.load(caseId, factor, "qlim").totalLoadMw())
                        .isCloseTo(base * factor, within(1e-9));
            }
        }
    }

    @Test
    void reactiveLimitsBindWhereTheDocumentedExplorationSaysTheyDo() {
        assertThat(limited("ieee14", 1.0)).isEmpty();
        assertThat(limited("ieee14", 1.2)).containsExactly(2, 3, 6);
        assertThat(limited("ieee14", 1.5)).containsExactly(2, 3, 6, 8);
        assertThat(limited("ieee30", 1.0)).containsExactly(2);
        assertThat(limited("ieee30", 1.2)).containsExactly(2, 5, 8, 11, 13);
    }

    @Test
    void theHeaviestLoadingsKeepTheDocumentedLowestVoltages() {
        assertThat(lowestVoltage(ReferenceSolutions.load("ieee14", 1.5, "qlim")))
                .isCloseTo(0.9028, within(5e-5));
        assertThat(lowestVoltage(ReferenceSolutions.load("ieee30", 1.5, "qlim")))
                .isCloseTo(0.7072, within(5e-5));
        assertThat(lowestVoltage(ReferenceSolutions.load("ieee30", 1.2, "qlim")))
                .isCloseTo(0.9410, within(5e-5));
    }

    @Test
    void slackReactiveLimitsStayOutOfTheWayInReactiveLimitRuns() {
        for (String caseId : List.of("ieee14", "ieee30")) {
            GeneratorSolution slack =
                    ReferenceSolutions.load(caseId, 1.0, "qlim").generators().get(0);
            assertThat(slack.bus()).isEqualTo(1);
            assertThat(slack.qLimit()).isEqualTo("NONE");
        }
    }

    private static List<Integer> limited(String caseId, double factor) {
        return ReferenceSolutions.load(caseId, factor, "qlim").generators().stream()
                .filter(generator -> !generator.qLimit().equals("NONE"))
                .map(GeneratorSolution::bus)
                .toList();
    }

    private static double lowestVoltage(ReferenceSolution solution) {
        return solution.buses().stream().mapToDouble(BusSolution::vm).min().orElseThrow();
    }

    @Test
    void branchesAreIdentifiedAndOrientedLikeTheCase() {
        ReferenceSolution solution = ReferenceSolutions.load("ieee14", 1.0, "plain");
        BranchSolution transformer = solution.branch("T4-7").orElseThrow();
        assertThat(transformer.from()).isEqualTo(4);
        assertThat(transformer.to()).isEqualTo(7);
        assertThat(transformer.apparentPowerMva()).isPositive();
    }
}
