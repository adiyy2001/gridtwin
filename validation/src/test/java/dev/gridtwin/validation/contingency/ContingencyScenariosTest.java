package dev.gridtwin.validation.contingency;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import dev.gridtwin.cases.CaseLoader;
import dev.gridtwin.domain.contingency.ContingencyAnalysis;
import dev.gridtwin.domain.contingency.ContingencyReport;
import dev.gridtwin.domain.contingency.ContingencyResult;
import dev.gridtwin.domain.contingency.SeverityTier;
import dev.gridtwin.domain.contingency.Violation;
import dev.gridtwin.domain.topology.NetworkTopology;
import dev.gridtwin.domain.topology.Position;
import dev.gridtwin.domain.twin.GridSolution;
import dev.gridtwin.domain.twin.IslandSolution;
import dev.gridtwin.domain.twin.IslandState;
import dev.gridtwin.domain.twin.TwinSolver;
import dev.gridtwin.domain.twin.TwinState;
import java.util.List;
import org.junit.jupiter.api.Test;

class ContingencyScenariosTest {

    private static final String COUPLER_BREAKER = "CPL.QA1";

    private final TwinSolver solver = TwinSolver.standard();
    private final ContingencyAnalysis analysis = ContingencyAnalysis.standard();

    private ContingencyReport ieee14() {
        NetworkTopology source = new NetworkTopology(CaseLoader.load("ieee14").network());
        return this.analysis.run(source, this.solver.solve(source.topology()));
    }

    private ContingencyReport ieee14WithCouplerOpen() {
        TwinState closed = CaseLoader.load("ieee14").gridModel().orElseThrow().initialState();
        TwinState open = closed.operate(COUPLER_BREAKER, Position.OPEN).state();
        return this.analysis.run(open, this.solver.solve(open).grid());
    }

    @Test
    void ieee14HasOneOutagePerBranchAndPerGenerator() {
        ContingencyReport report = this.ieee14();

        assertThat(report.ranked()).hasSize(25);
        assertThat(report.ranked().stream().filter(result -> result.id().startsWith("branch:")))
                .hasSize(20);
        assertThat(report.ranked().stream().filter(result -> result.id().startsWith("generator:")))
                .hasSize(5);
        assertThat(report.baseSeverity().tier()).isEqualTo(SeverityTier.SECURE);
        assertThat(report.baseViolations()).isEmpty();
    }

    @Test
    void lineSevenToEightLeavesBusEightAsAnEnergizedOneBusIslandAndSolvesTheRest() {
        GridSolution solution = this.ieee14().find("branch:L7-8").orElseThrow().solution();

        assertThat(solution.islands()).hasSize(2);
        IslandSolution lone = solution.islandOf(8).orElseThrow();
        assertThat(lone.island().buses()).containsExactly(8);
        assertThat(lone.state()).isEqualTo(IslandState.ENERGIZED);
        assertThat(lone.island().slack().orElseThrow().generatorId()).isEqualTo("G8");
        assertThat(solution.bus(8).orElseThrow().voltageMagnitude()).isCloseTo(1.09, within(1e-9));
        assertThat(solution.generator("G8").orElseThrow().activeMw()).isCloseTo(0.0, within(1e-9));
        IslandSolution rest = solution.islandOf(1).orElseThrow();
        assertThat(rest.state()).isEqualTo(IslandState.ENERGIZED);
        assertThat(rest.island().buses()).hasSize(13);
        assertThat(solution.converged()).isTrue();
        assertThat(solution.shedLoadMw()).isZero();
        assertThat(solution.branch("L7-8").orElseThrow().energized()).isFalse();
    }

    @Test
    void theSlackGeneratorOutageMovesTheReferenceByTheRuleInAdrFive() {
        GridSolution solution = this.ieee14().find("generator:G1").orElseThrow().solution();

        assertThat(solution.islands()).hasSize(1);
        assertThat(solution.islands().get(0).island().slack().orElseThrow().generatorId())
                .isEqualTo("G2");
        assertThat(solution.islands().get(0).island().slack().orElseThrow().bus()).isEqualTo(2);
        assertThat(solution.bus(2).orElseThrow().angleDegrees()).isCloseTo(-4.98, within(1e-9));
        assertThat(solution.generator("G1").orElseThrow().activeMw()).isZero();
        assertThat(solution.generator("G2").orElseThrow().activeMw()).isGreaterThan(200.0);
        assertThat(solution.totalGenerationMw())
                .isCloseTo(solution.totalLoadMw() + solution.totalLossMw(), within(1e-4));
    }

    @Test
    void aPlainGeneratorOutageKeepsTheSlackAndRaisesItsOutput() {
        ContingencyReport report = this.ieee14();

        GridSolution solution = report.find("generator:G2").orElseThrow().solution();

        assertThat(solution.islands().get(0).island().slack().orElseThrow().generatorId())
                .isEqualTo("G1");
        assertThat(solution.generator("G2").orElseThrow().activeMw()).isZero();
        assertThat(solution.generator("G1").orElseThrow().activeMw())
                .isGreaterThan(report.base().generator("G1").orElseThrow().activeMw() + 39.0);
    }

    @Test
    void theRankingPutsTheCollapseFirstThenSortsByScoreAndIsDeterministic() {
        ContingencyReport report = this.ieee14();

        assertThat(report.ranked().get(0).id()).isEqualTo("branch:L1-2");
        assertThat(report.ranked().get(0).severity().tier()).isEqualTo(SeverityTier.NON_CONVERGED);
        List<Double> scores =
                report.ranked().stream()
                        .filter(result -> result.severity().tier() == SeverityTier.DEGRADED)
                        .map(result -> result.severity().score())
                        .toList();
        assertThat(scores).isSortedAccordingTo((first, second) -> Double.compare(second, first));
        assertThat(this.ieee14().ranked().stream().map(ContingencyResult::id))
                .containsExactlyElementsOf(
                        report.ranked().stream().map(ContingencyResult::id).toList());
    }

    @Test
    void theViolationsOfAnOutageNameTheOverloadedBranchesAndTheVoltages() {
        ContingencyResult result = this.ieee14().find("branch:L2-3").orElseThrow();

        assertThat(result.violations())
                .anyMatch(
                        violation ->
                                violation instanceof Violation.BranchOverload overload
                                        && overload.loading() > 1.0);
        assertThat(result.severity().overloadTerm()).isPositive();
        assertThat(result.solution().overloadedBranches()).isNotEmpty();
    }

    @Test
    void withTheCouplerOpenTheBaseCaseAlreadyShowsTheOverloadedLine() {
        ContingencyReport report = this.ieee14WithCouplerOpen();

        assertThat(report.baseViolations())
                .filteredOn(Violation.BranchOverload.class::isInstance)
                .hasSize(1);
        assertThat(report.baseSeverity().tier()).isEqualTo(SeverityTier.DEGRADED);
        assertThat(report.ranked()).hasSize(25);
        assertThat(report.ranked().stream().map(ContingencyResult::id))
                .contains("branch:L2-4", "generator:G1");
    }

    @Test
    void theAnalysisLeavesTheBaseSolutionUntouched() {
        NetworkTopology source = new NetworkTopology(CaseLoader.load("ieee14").network());
        GridSolution base = this.solver.solve(source.topology());

        this.analysis.run(source, base, 4);

        assertThat(base).isEqualTo(this.solver.solve(source.topology()));
    }
}
