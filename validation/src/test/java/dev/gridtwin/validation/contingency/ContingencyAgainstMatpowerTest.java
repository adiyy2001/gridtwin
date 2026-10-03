package dev.gridtwin.validation.contingency;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import dev.gridtwin.cases.CaseLoader;
import dev.gridtwin.domain.contingency.ContingencyAnalysis;
import dev.gridtwin.domain.contingency.ContingencyOptions;
import dev.gridtwin.domain.contingency.ContingencyReport;
import dev.gridtwin.domain.contingency.ContingencyResult;
import dev.gridtwin.domain.powerflow.BranchResult;
import dev.gridtwin.domain.powerflow.BusResult;
import dev.gridtwin.domain.powerflow.EjmlSparseLuSolver;
import dev.gridtwin.domain.powerflow.GeneratorResult;
import dev.gridtwin.domain.powerflow.PowerFlow;
import dev.gridtwin.domain.powerflow.PowerFlowOptions;
import dev.gridtwin.domain.topology.NetworkTopology;
import dev.gridtwin.domain.topology.TopologySource;
import dev.gridtwin.domain.twin.GridModel;
import dev.gridtwin.domain.twin.GridSolution;
import dev.gridtwin.domain.twin.IslandState;
import dev.gridtwin.domain.twin.TwinSolver;
import dev.gridtwin.domain.twin.TwinState;
import dev.gridtwin.validation.contingency.N1Reference.OutageSolution;
import dev.gridtwin.validation.reference.ReferenceSolution.BranchSolution;
import dev.gridtwin.validation.reference.ReferenceSolution.BusSolution;
import dev.gridtwin.validation.reference.ReferenceSolution.GeneratorSolution;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

class ContingencyAgainstMatpowerTest {

    private static final double VOLTAGE_TOLERANCE_PU = 1e-6;
    private static final double ANGLE_TOLERANCE_DEGREES = 1e-4;
    private static final double FLOW_TOLERANCE_MW = 1e-4 * 100.0;
    private static final double GENERATION_TOLERANCE_MW = 1e-3;

    static Stream<Arguments> referenceFiles() {
        return Stream.of(
                Arguments.of("ieee14", "plain", 25),
                Arguments.of("ieee14", "qlim", 24),
                Arguments.of("ieee30", "plain", 47),
                Arguments.of("ieee30", "qlim", 46));
    }

    static Stream<Arguments> substationFiles() {
        return referenceFiles().filter(arguments -> arguments.get()[0].equals("ieee14"));
    }

    private static TwinSolver solverFor(boolean enforceQLimits) {
        return new TwinSolver(
                new PowerFlow(
                        PowerFlowOptions.standard().withReactiveLimits(enforceQLimits),
                        EjmlSparseLuSolver::new));
    }

    private static ContingencyReport analyse(
            TwinSolver solver, TopologySource source, GridSolution base) {
        return new ContingencyAnalysis(solver, ContingencyOptions.standard()).run(source, base);
    }

    @ParameterizedTest(name = "{0} ({1}), {2} solved outages")
    @MethodSource("referenceFiles")
    void everySolvedOutageMatchesMatpower(String caseId, String variant, int solvedCount) {
        N1Reference reference = N1References.load(caseId, variant);
        TwinSolver solver = solverFor(reference.enforceQLimits());
        NetworkTopology source = new NetworkTopology(CaseLoader.load(caseId).network());

        ContingencyReport report = analyse(solver, source, solver.solve(source.topology()));

        List<OutageSolution> solved =
                reference.outages().stream().filter(OutageSolution::hasSolution).toList();
        assertThat(solved).hasSize(solvedCount);
        for (OutageSolution expected : solved) {
            ContingencyResult actual = report.find(expected.outageId()).orElseThrow();
            assertThat(actual.solution().converged())
                    .as("%s converges", expected.outageId())
                    .isTrue();
            compare(expected, actual.solution());
        }
    }

    @ParameterizedTest(name = "{0} ({1}) through the substation model")
    @MethodSource("substationFiles")
    void theSubstationTwinGivesTheSameIeee14Results(
            String caseId, String variant, int solvedCount) {
        N1Reference reference = N1References.load(caseId, variant);
        TwinSolver solver = solverFor(reference.enforceQLimits());
        GridModel model = CaseLoader.load(caseId).gridModel().orElseThrow();
        TwinState state = model.initialState();

        ContingencyReport report = analyse(solver, state, solver.solve(state).grid());

        for (OutageSolution expected : reference.outages()) {
            if (expected.hasSolution()) {
                compare(expected, report.find(expected.outageId()).orElseThrow().solution());
            }
        }
    }

    @ParameterizedTest(name = "{0} ({1})")
    @MethodSource("referenceFiles")
    void outagesThatIslandTheNetworkLeaveTheCutOffBusesInTheirOwnIslands(
            String caseId, String variant, int solvedCount) {
        N1Reference reference = N1References.load(caseId, variant);
        TwinSolver solver = solverFor(reference.enforceQLimits());
        NetworkTopology source = new NetworkTopology(CaseLoader.load(caseId).network());
        ContingencyReport report = analyse(solver, source, solver.solve(source.topology()));
        var network = CaseLoader.load(caseId).network();

        List<OutageSolution> islanding =
                reference.outages().stream()
                        .filter(outage -> outage.status().equals("islanded"))
                        .toList();

        assertThat(islanding).isNotEmpty();
        for (OutageSolution outage : islanding) {
            GridSolution solution = report.find(outage.outageId()).orElseThrow().solution();
            assertThat(solution.islands()).as(outage.outageId()).hasSize(2);
            for (int bus : outage.unreachable()) {
                var island = solution.islandOf(bus).orElseThrow();
                boolean hasGenerator =
                        network.generators().stream().anyMatch(generator -> generator.bus() == bus);
                double load =
                        network.loads().stream()
                                .filter(candidate -> candidate.bus() == bus)
                                .mapToDouble(candidate -> candidate.activePowerMw())
                                .sum();
                assertThat(island.state() == IslandState.ENERGIZED)
                        .as("%s island of bus %d is energized", outage.outageId(), bus)
                        .isEqualTo(hasGenerator);
                assertThat(island.shedLoadMw())
                        .as("%s load shed at bus %d", outage.outageId(), bus)
                        .isCloseTo(hasGenerator ? 0.0 : load, within(1e-9));
            }
        }
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("divergingCases")
    void whereMatpowerDivergesWithReactiveLimitsTheTwinReportsTheCollapse(String caseId) {
        N1Reference reference = N1References.load(caseId, "qlim");
        TwinSolver solver = solverFor(true);
        NetworkTopology source = new NetworkTopology(CaseLoader.load(caseId).network());
        ContingencyReport report = analyse(solver, source, solver.solve(source.topology()));

        assertThat(reference.find("branch", "L1-2").orElseThrow().status()).isEqualTo("diverged");
        ContingencyResult result = report.find("branch:L1-2").orElseThrow();
        assertThat(result.solution().converged()).isFalse();
        assertThat(result.rank()).isEqualTo(1);
        assertThat(N1References.load(caseId, "plain").find("branch", "L1-2").orElseThrow().solved())
                .isTrue();
    }

    static Stream<String> divergingCases() {
        return Stream.of("ieee14", "ieee30");
    }

    private static void compare(OutageSolution expected, GridSolution actual) {
        String name = expected.outageId();
        for (BusSolution bus : expected.buses()) {
            BusResult result = actual.bus(bus.number()).orElseThrow();
            assertThat(result.voltageMagnitude())
                    .as("%s voltage at bus %d", name, bus.number())
                    .isCloseTo(bus.vm(), within(VOLTAGE_TOLERANCE_PU));
            assertThat(result.angleDegrees())
                    .as("%s angle at bus %d", name, bus.number())
                    .isCloseTo(bus.vaDegrees(), within(ANGLE_TOLERANCE_DEGREES));
        }
        BusSolution reference =
                expected.buses().stream()
                        .filter(bus -> bus.number() == expected.referenceBus())
                        .findFirst()
                        .orElseThrow();
        BusResult referenceResult = actual.bus(expected.referenceBus()).orElseThrow();
        for (BusSolution bus : expected.buses()) {
            double expectedDifference = bus.vaDegrees() - reference.vaDegrees();
            double actualDifference =
                    actual.bus(bus.number()).orElseThrow().angleDegrees()
                            - referenceResult.angleDegrees();
            assertThat(actualDifference)
                    .as("%s angle difference of bus %d from the reference bus", name, bus.number())
                    .isCloseTo(expectedDifference, within(ANGLE_TOLERANCE_DEGREES));
        }
        for (BranchSolution branch : expected.branches()) {
            BranchResult result = actual.branch(branch.id()).orElseThrow();
            assertThat(result.activeFromMw())
                    .as("%s P from of %s", name, branch.id())
                    .isCloseTo(branch.pFromMw(), within(FLOW_TOLERANCE_MW));
            assertThat(result.reactiveFromMvar())
                    .as("%s Q from of %s", name, branch.id())
                    .isCloseTo(branch.qFromMvar(), within(FLOW_TOLERANCE_MW));
            assertThat(result.activeToMw())
                    .as("%s P to of %s", name, branch.id())
                    .isCloseTo(branch.pToMw(), within(FLOW_TOLERANCE_MW));
        }
        for (GeneratorSolution generator : expected.generators()) {
            GeneratorResult result =
                    actual.generators().stream()
                            .filter(candidate -> candidate.bus() == generator.bus())
                            .findFirst()
                            .orElseThrow();
            assertThat(result.activeMw())
                    .as("%s P of the generator at bus %d", name, generator.bus())
                    .isCloseTo(generator.pMw(), within(GENERATION_TOLERANCE_MW));
            assertThat(result.reactiveMvar())
                    .as("%s Q of the generator at bus %d", name, generator.bus())
                    .isCloseTo(generator.qMvar(), within(GENERATION_TOLERANCE_MW));
        }
        assertThat(actual.totalLossMw())
                .as("%s losses", name)
                .isCloseTo(expected.totalLossMw(), within(GENERATION_TOLERANCE_MW));
    }

    @Test
    void theReferencesCarryProvenanceAndTheSlackRule() {
        N1Reference reference = N1References.load("ieee14", "qlim");

        assertThat(reference.provenance().matpowerVersion()).isEqualTo("8.1");
        assertThat(reference.provenance().generatedBy())
                .isEqualTo("tools/reference/generate_n1_references.m");
        assertThat(reference.slackRule()).contains("largest PMAX");
        assertThat(reference.outages()).hasSize(25);
    }
}
