package dev.gridtwin.domain.contingency;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import dev.gridtwin.domain.model.Network;
import dev.gridtwin.domain.topology.NetworkTopology;
import dev.gridtwin.domain.twin.GridSolution;
import dev.gridtwin.domain.twin.IslandState;
import dev.gridtwin.domain.twin.TwinSolver;
import java.util.List;
import java.util.concurrent.ForkJoinPool;
import org.junit.jupiter.api.Test;

class ContingencyAnalysisTest {

    private final TwinSolver solver = TwinSolver.standard();
    private final ContingencyAnalysis analysis = ContingencyAnalysis.standard();

    private ContingencyReport report(Network network) {
        NetworkTopology source = new NetworkTopology(network);
        return this.analysis.run(source, this.solver.solve(source.topology()));
    }

    @Test
    void thereIsOneOutagePerBranchAndPerGenerator() {
        ContingencyReport report = this.report(ContingencyNetworks.meshWithSpur(30.0, 50.0));

        assertThat(report.ranked()).hasSize(10);
        assertThat(report.ranked().stream().map(ContingencyResult::id))
                .contains("branch:L1-2", "branch:L5-6", "generator:G1", "generator:G6");
        assertThat(report.ranked().stream().map(ContingencyResult::rank))
                .containsExactly(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
    }

    @Test
    void outagesOfBranchesAndGeneratorsOutOfServiceAreSkipped() {
        NetworkTopology source = new NetworkTopology(ContingencyNetworks.meshWithSpur(30.0, 50.0));
        var topology =
                source.topology(
                        dev.gridtwin.domain.topology.Outages.none()
                                .withBranch("L1-2")
                                .withGenerator("G2"));

        assertThat(this.analysis.outagesOf(topology).stream().map(Outage::id))
                .doesNotContain("branch:L1-2", "generator:G2")
                .contains("branch:L1-3", "generator:G1");
    }

    @Test
    void everyResultCarriesTheFullSnapshotOfItsOutage() {
        ContingencyReport report = this.report(ContingencyNetworks.meshWithSpur(30.0, 50.0));

        ContingencyResult lineOutage = report.find("branch:L2-3").orElseThrow();

        assertThat(lineOutage.solution().branch("L2-3").orElseThrow().energized()).isFalse();
        assertThat(lineOutage.solution().branch("L1-2").orElseThrow().energized()).isTrue();
        assertThat(lineOutage.solution().buses()).hasSize(6);
        assertThat(lineOutage.solution().converged()).isTrue();
        assertThat(report.find("branch:none")).isEmpty();
    }

    @Test
    void aGeneratorOutageIsPickedUpBySlack() {
        ContingencyReport report = this.report(ContingencyNetworks.meshWithSpur(30.0, 50.0));
        double base = report.base().generator("G1").orElseThrow().activeMw();

        GridSolution without = report.find("generator:G2").orElseThrow().solution();

        assertThat(without.generator("G2").orElseThrow().activeMw()).isZero();
        assertThat(without.generator("G1").orElseThrow().activeMw()).isGreaterThan(base + 50.0);
    }

    @Test
    void theSlackGeneratorOutageMovesTheSlackToTheLargestRemainingUnit() {
        ContingencyReport report = this.report(ContingencyNetworks.meshWithSpur(30.0, 50.0));

        GridSolution without = report.find("generator:G1").orElseThrow().solution();

        assertThat(without.islands()).hasSize(1);
        assertThat(without.islands().get(0).island().slack().orElseThrow().generatorId())
                .isEqualTo("G2");
        assertThat(without.converged()).isTrue();
        assertThat(without.generator("G1").orElseThrow().activeMw()).isZero();
    }

    @Test
    void aSpurOutageLeavesAnEnergizedIslandWhenItHoldsAGenerator() {
        ContingencyReport report = this.report(ContingencyNetworks.meshWithSpur(30.0, 50.0));

        GridSolution split = report.find("branch:L4-5").orElseThrow().solution();

        assertThat(split.islands()).hasSize(2);
        assertThat(split.islands()).allMatch(island -> island.state() == IslandState.ENERGIZED);
        assertThat(split.shedLoadMw()).isZero();
        assertThat(split.generator("G6").orElseThrow().activeMw()).isCloseTo(30.0, within(0.5));
    }

    @Test
    void aSpurIslandThatCannotCarryItsLoadReportsTheSlackAboveItsLimit() {
        ContingencyReport report = this.report(ContingencyNetworks.meshWithSpur(60.0, 50.0));

        ContingencyResult result = report.find("branch:L4-5").orElseThrow();

        assertThat(result.violations())
                .anyMatch(
                        violation ->
                                violation instanceof Violation.SlackAboveLimit slack
                                        && slack.generatorId().equals("G6"));
        assertThat(result.severity().tier()).isEqualTo(SeverityTier.DEGRADED);
        assertThat(result.severity().slackTerm()).isPositive();
    }

    @Test
    void aSpurWithoutAGeneratorLosesItsLoad() {
        ContingencyReport report = this.report(ContingencyNetworks.meshWithSpur(30.0, 50.0));

        GridSolution lost = report.find("generator:G6").orElseThrow().solution();
        GridSolution cut = report.find("branch:L4-5").orElseThrow().solution();

        assertThat(lost.shedLoadMw()).isZero();
        assertThat(cut.shedLoadMw()).isZero();
        ContingencyReport trimmed = this.reportWithoutGenerator();
        ContingencyResult result = trimmed.find("branch:L4-5").orElseThrow();
        assertThat(result.solution().shedLoadMw()).isCloseTo(30.0, within(1e-9));
        assertThat(result.violations()).anyMatch(Violation.LoadShed.class::isInstance);
        assertThat(result.severity().shedTerm()).isPositive();
    }

    private ContingencyReport reportWithoutGenerator() {
        Network base = ContingencyNetworks.meshWithSpur(30.0, 50.0);
        Network network =
                base.withGenerators(
                        base.generators().stream()
                                .map(
                                        generator ->
                                                generator.id().equals("G6")
                                                        ? generator.withInService(false)
                                                        : generator)
                                .toList());
        return this.report(network);
    }

    @Test
    void anOutageThatCollapsesTheNetworkRanksAboveEverythingElse() {
        ContingencyReport report =
                this.report(ContingencyNetworks.parallelPair(1500.0, 300.0, 5000.0));

        ContingencyResult first = report.ranked().get(0);

        assertThat(first.severity().tier()).isEqualTo(SeverityTier.NON_CONVERGED);
        assertThat(first.violations()).anyMatch(Violation.IslandCollapse.class::isInstance);
        assertThat(first.solution().converged()).isFalse();
        assertThat(first.solution().shedLoadMw()).isGreaterThan(0.0);
        assertThat(report.countIn(SeverityTier.NON_CONVERGED)).isEqualTo(2);
    }

    @Test
    void losingTheOnlyGeneratorIsABlackout() {
        ContingencyReport report =
                this.report(ContingencyNetworks.parallelPair(100.0, 20.0, 400.0));

        ContingencyResult generator = report.find("generator:G1").orElseThrow();

        assertThat(generator.severity().tier()).isEqualTo(SeverityTier.BLACKOUT);
        assertThat(generator.solution().shedLoadMw()).isCloseTo(100.0, within(1e-9));
        assertThat(report.ranked().get(0).id()).isEqualTo("generator:G1");
    }

    @Test
    void secureOutagesTieAndBreakByOutageId() {
        ContingencyReport report = this.report(ContingencyNetworks.meshWithSpur(30.0, 50.0));

        List<String> secure =
                report.ranked().stream()
                        .filter(result -> result.severity().tier() == SeverityTier.SECURE)
                        .map(ContingencyResult::id)
                        .toList();

        assertThat(secure).isNotEmpty().isSorted();
    }

    @Test
    void theRankingIsStableAcrossRuns() {
        Network network = ContingencyNetworks.meshWithSpur(60.0, 50.0);

        assertThat(this.report(network)).isEqualTo(this.report(network));
    }

    @Test
    void aParallelRunEqualsTheSequentialRunExactly() {
        Network network = ContingencyNetworks.meshWithSpur(60.0, 50.0);
        NetworkTopology source = new NetworkTopology(network);
        GridSolution base = this.solver.solve(source.topology());

        ContingencyReport sequential = this.analysis.run(source, base);
        ContingencyReport viaCount = this.analysis.run(source, base, 4);
        try (ForkJoinPool pool = new ForkJoinPool(3)) {
            ContingencyReport viaPool = this.analysis.run(source, base, pool);
            assertThat(viaPool).isEqualTo(sequential);
        }

        assertThat(viaCount).isEqualTo(sequential);
    }

    @Test
    void theBaseCaseIsAssessedWithTheSameRules() {
        NetworkTopology source =
                new NetworkTopology(ContingencyNetworks.parallelPair(300.0, 50.0, 100.0));
        ContingencyReport report = this.analysis.run(source, this.solver.solve(source.topology()));

        assertThat(report.baseViolations()).anyMatch(Violation.BranchOverload.class::isInstance);
        assertThat(report.baseSeverity().tier()).isEqualTo(SeverityTier.DEGRADED);
        assertThat(report.baseSeverity().overloadTerm()).isPositive();
    }
}
