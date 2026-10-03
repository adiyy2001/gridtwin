package dev.gridtwin.domain.contingency;

import dev.gridtwin.domain.model.Branch;
import dev.gridtwin.domain.model.Generator;
import dev.gridtwin.domain.model.Network;
import dev.gridtwin.domain.topology.Outages;
import dev.gridtwin.domain.topology.Topology;
import dev.gridtwin.domain.topology.TopologySource;
import dev.gridtwin.domain.twin.GridSolution;
import dev.gridtwin.domain.twin.TwinSolver;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.ForkJoinPool;
import java.util.stream.IntStream;
import java.util.stream.Stream;

public final class ContingencyAnalysis {

    private static final Comparator<ContingencyResult> RANKING =
            Comparator.comparing(ContingencyResult::severity, Severity.MOST_SEVERE_FIRST)
                    .thenComparing(ContingencyResult::id);

    private final TwinSolver solver;
    private final Assessment assessment;

    public ContingencyAnalysis(TwinSolver solver, ContingencyOptions options) {
        this.solver = solver;
        this.assessment = new Assessment(options);
    }

    public static ContingencyAnalysis standard() {
        return new ContingencyAnalysis(TwinSolver.standard(), ContingencyOptions.standard());
    }

    public List<Outage> outagesOf(Topology topology) {
        Network network = topology.network();
        return Stream.concat(
                        network.branches().stream()
                                .filter(Branch::inService)
                                .map(branch -> Outage.branch(branch.id())),
                        network.generators().stream()
                                .filter(Generator::inService)
                                .map(generator -> Outage.generator(generator.id())))
                .toList();
    }

    public ContingencyReport run(TopologySource source, GridSolution base) {
        List<Outage> outages = this.outagesOf(base.topology());
        return this.report(base, outages.stream().map(outage -> this.solve(source, base, outage)));
    }

    public ContingencyReport run(TopologySource source, GridSolution base, ForkJoinPool pool) {
        List<Outage> outages = this.outagesOf(base.topology());
        List<ContingencyResult> results =
                pool.submit(
                                () ->
                                        outages.parallelStream()
                                                .map(outage -> this.solve(source, base, outage))
                                                .toList())
                        .join();
        return this.report(base, results.stream());
    }

    public ContingencyReport run(TopologySource source, GridSolution base, int parallelism) {
        try (ForkJoinPool pool = new ForkJoinPool(parallelism)) {
            return this.run(source, base, pool);
        }
    }

    private ContingencyResult solve(TopologySource source, GridSolution base, Outage outage) {
        Outages outages = outage.addTo(Outages.none());
        GridSolution solution = this.solver.solve(source.topology(outages), base.warmStart());
        Assessment.Result assessed = this.assessment.assess(solution);
        return new ContingencyResult(
                0, outage, solution, assessed.violations(), assessed.severity());
    }

    private ContingencyReport report(GridSolution base, Stream<ContingencyResult> results) {
        List<ContingencyResult> sorted = results.sorted(RANKING).toList();
        List<ContingencyResult> ranked =
                IntStream.range(0, sorted.size())
                        .mapToObj(position -> sorted.get(position).withRank(position + 1))
                        .toList();
        Assessment.Result baseAssessment = this.assessment.assess(base);
        return new ContingencyReport(
                base, baseAssessment.violations(), baseAssessment.severity(), ranked);
    }
}
