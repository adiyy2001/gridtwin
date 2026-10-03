package dev.gridtwin.bench;

import dev.gridtwin.cases.CaseLoader;
import dev.gridtwin.domain.cascade.CascadeSimulation;
import dev.gridtwin.domain.contingency.ContingencyAnalysis;
import dev.gridtwin.domain.contingency.Outage;
import dev.gridtwin.domain.model.Network;
import dev.gridtwin.domain.powerflow.PowerFlow;
import dev.gridtwin.domain.powerflow.PowerFlowResult;
import dev.gridtwin.domain.topology.NetworkTopology;
import dev.gridtwin.domain.twin.GridSolution;
import dev.gridtwin.domain.twin.TwinSolver;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ForkJoinPool;
import java.util.stream.IntStream;

public final class JavaSuite {

    public static final String NAME = "java";
    public static final double SOLVE_TARGET_MS = 10.0;
    public static final double CONTINGENCY_TARGET_MS = 500.0;

    private final Harness harness;
    private final Settings settings;

    public JavaSuite(Settings settings) {
        this.settings = settings;
        this.harness = new Harness(settings);
    }

    public Report run() {
        List<Measurement> measurements = new ArrayList<>();
        Measurement warmIeee30 = this.solveMeasurements(measurements);
        List<Measurement> contingencies = this.contingencyMeasurements(measurements);
        measurements.add(this.cascadeMeasurement());
        List<Target> targets =
                List.of(
                        Target.p95Below("IEEE 30 solve", warmIeee30, SOLVE_TARGET_MS),
                        Target.p95Below(
                                "IEEE 30 N-1 sequential",
                                contingencies.get(0),
                                CONTINGENCY_TARGET_MS),
                        Target.p95Below(
                                "IEEE 30 N-1 on all cores",
                                contingencies.get(contingencies.size() - 1),
                                CONTINGENCY_TARGET_MS));
        return new Report(
                NAME,
                ZonedDateTime.now().toString(),
                Hardware.detect(),
                this.settings,
                measurements,
                targets);
    }

    private Measurement solveMeasurements(List<Measurement> measurements) {
        Measurement warmIeee30 = null;
        for (String caseId : List.of("ieee14", "ieee30")) {
            Network network = CaseLoader.load(caseId).network();
            PowerFlow powerFlow = PowerFlow.standard();
            PowerFlowResult base = powerFlow.solve(network);
            measurements.add(
                    this.harness.measure(
                            caseId + " solve, flat start",
                            "PowerFlow.standard(): tolerance 1e-8 pu, reactive limits enforced",
                            () -> powerFlow.solve(network)));
            Measurement warm =
                    this.harness.measure(
                            caseId + " solve, warm start",
                            "PowerFlow.standard() warm-started from the base solution",
                            () -> powerFlow.solve(network, base.warmStart()));
            measurements.add(warm);
            if (caseId.equals("ieee30")) {
                warmIeee30 = warm;
            }
            TwinSolver twin = TwinSolver.standard();
            NetworkTopology source = new NetworkTopology(network);
            measurements.add(
                    this.harness.measure(
                            caseId + " twin solve, flat start",
                            "TwinSolver.standard(): tolerance 1e-10 pu, islands, reactive limits",
                            () -> twin.solve(source.topology())));
        }
        return warmIeee30;
    }

    private List<Measurement> contingencyMeasurements(List<Measurement> measurements) {
        List<Measurement> ieee30 = new ArrayList<>();
        for (String caseId : List.of("ieee14", "ieee30")) {
            NetworkTopology source = new NetworkTopology(CaseLoader.load(caseId).network());
            ContingencyAnalysis analysis = ContingencyAnalysis.standard();
            GridSolution base = TwinSolver.standard().solve(source.topology());
            int outages = analysis.outagesOf(base.topology()).size();
            Measurement sequential =
                    this.harness.measure(
                            caseId + " N-1 sequential",
                            outages + " outages, one thread",
                            () -> analysis.run(source, base));
            measurements.add(sequential);
            if (caseId.equals("ieee30")) {
                ieee30.add(sequential);
            }
            for (int parallelism : this.parallelismLevels()) {
                try (ForkJoinPool pool = new ForkJoinPool(parallelism)) {
                    Measurement parallel =
                            this.harness.measure(
                                    caseId + " N-1 parallel, " + parallelism + " threads",
                                    outages
                                            + " outages on a dedicated ForkJoinPool of "
                                            + parallelism,
                                    () -> analysis.run(source, base, pool));
                    measurements.add(parallel);
                    if (caseId.equals("ieee30")) {
                        ieee30.add(parallel);
                    }
                }
            }
        }
        return ieee30;
    }

    private List<Integer> parallelismLevels() {
        int cores = Runtime.getRuntime().availableProcessors();
        return IntStream.of(2, 4, 8, cores)
                .filter(level -> level <= cores)
                .distinct()
                .sorted()
                .boxed()
                .toList();
    }

    private Measurement cascadeMeasurement() {
        NetworkTopology source = new NetworkTopology(CaseLoader.load("ieee14").network());
        TwinSolver solver = TwinSolver.standard();
        GridSolution base = solver.solve(source.topology());
        CascadeSimulation simulation = CascadeSimulation.standard();
        return this.harness.measure(
                "ieee14 cascade from the outage of L2-4",
                "trip the worst branch above 120% until stable, collapsed or blacked out",
                () -> simulation.run(source, base, Outage.branch("L2-4")));
    }
}
