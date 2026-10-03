package dev.gridtwin.validation.contingency;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import dev.gridtwin.cases.CaseLoader;
import dev.gridtwin.domain.contingency.ContingencyAnalysis;
import dev.gridtwin.domain.contingency.ContingencyReport;
import dev.gridtwin.domain.contingency.ContingencyResult;
import dev.gridtwin.domain.contingency.Severity;
import dev.gridtwin.domain.model.Network;
import dev.gridtwin.domain.powerflow.PowerFlowResult;
import dev.gridtwin.domain.topology.NetworkTopology;
import dev.gridtwin.domain.twin.GridSolution;
import dev.gridtwin.domain.twin.IslandSolution;
import dev.gridtwin.domain.twin.IslandState;
import dev.gridtwin.domain.twin.TwinSolver;
import dev.gridtwin.validation.property.Discard;
import dev.gridtwin.validation.property.Property;
import dev.gridtwin.validation.property.RandomNetworks;
import java.util.concurrent.ForkJoinPool;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

class ContingencyPropertiesTest {

    private static final double BALANCE_TOLERANCE_MW = 1e-6 * 100.0;

    private final TwinSolver solver = TwinSolver.standard();
    private final ContingencyAnalysis analysis = ContingencyAnalysis.standard();

    static Stream<String> testSystems() {
        return Stream.of("ieee14", "ieee30");
    }

    private GridSolution baseOrDiscard(NetworkTopology source) {
        GridSolution base = this.solver.solve(source.topology());
        Discard.unless(base.converged(), "the random network has no base solution");
        return base;
    }

    @ParameterizedTest
    @MethodSource("testSystems")
    void aParallelRunEqualsTheSequentialRunOnTheTestSystems(String caseId) {
        NetworkTopology source = new NetworkTopology(CaseLoader.load(caseId).network());
        GridSolution base = this.solver.solve(source.topology());

        ContingencyReport sequential = this.analysis.run(source, base);

        for (int parallelism : new int[] {2, 4, 8}) {
            assertThat(this.analysis.run(source, base, parallelism))
                    .as("parallelism %d", parallelism)
                    .isEqualTo(sequential);
        }
    }

    @Test
    void aParallelRunEqualsTheSequentialRunOnRandomNetworks() {
        try (ForkJoinPool pool = new ForkJoinPool(4)) {
            Property.forAll(
                            "parallel equals sequential",
                            RandomNetworks::generate,
                            network -> {
                                NetworkTopology source = new NetworkTopology(network);
                                GridSolution base = this.baseOrDiscard(source);
                                assertThat(this.analysis.run(source, base, pool))
                                        .isEqualTo(this.analysis.run(source, base));
                            })
                    .withTries(60)
                    .run();
        }
    }

    @Test
    void everyOutageOnARandomNetworkYieldsAWellFormedRankedResult() {
        Property.forAll(
                        "well formed N-1",
                        RandomNetworks::generate,
                        network -> {
                            NetworkTopology source = new NetworkTopology(network);
                            ContingencyReport report =
                                    this.analysis.run(source, this.baseOrDiscard(source));
                            assertRankedAndWellFormed(network, report);
                        })
                .withTries(80)
                .run();
    }

    private static void assertRankedAndWellFormed(Network network, ContingencyReport report) {
        assertThat(report.ranked()).isNotEmpty();
        for (int index = 0; index < report.ranked().size(); index++) {
            ContingencyResult result = report.ranked().get(index);
            assertThat(result.rank()).isEqualTo(index + 1);
            if (index > 0) {
                Severity previous = report.ranked().get(index - 1).severity();
                assertThat(Severity.MOST_SEVERE_FIRST.compare(previous, result.severity()))
                        .isLessThanOrEqualTo(0);
            }
            assertThat(Double.isFinite(result.severity().score())).isTrue();
            assertIslandsAreEnergizedWithASlackOrDark(result.solution());
            assertBalance(result.solution());
        }
        assertThat(network.branches().size() + network.generators().size())
                .isGreaterThanOrEqualTo(report.ranked().size());
    }

    private static void assertIslandsAreEnergizedWithASlackOrDark(GridSolution solution) {
        for (IslandSolution island : solution.islands()) {
            assertThat(island.island().energized())
                    .isEqualTo(island.state() != IslandState.DEENERGIZED);
            if (island.state() == IslandState.ENERGIZED) {
                assertThat(island.island().slack()).isPresent();
                assertThat(island.result().orElseThrow().buses())
                        .allMatch(bus -> Double.isFinite(bus.voltageMagnitude()));
            }
        }
    }

    private static void assertBalance(GridSolution solution) {
        for (IslandSolution island : solution.islands()) {
            if (island.state() == IslandState.ENERGIZED) {
                PowerFlowResult result = island.result().orElseThrow();
                assertThat(result.totalGenerationMw())
                        .isCloseTo(
                                result.totalLoadMw()
                                        + result.totalLossMw()
                                        + result.shuntConsumptionMw(),
                                within(BALANCE_TOLERANCE_MW));
            }
        }
    }
}
