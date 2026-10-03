package dev.gridtwin.validation.report;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import dev.gridtwin.cases.CaseLoader;
import dev.gridtwin.domain.contingency.ContingencyAnalysis;
import dev.gridtwin.domain.contingency.ContingencyOptions;
import dev.gridtwin.domain.contingency.ContingencyReport;
import dev.gridtwin.domain.powerflow.BranchResult;
import dev.gridtwin.domain.powerflow.BusResult;
import dev.gridtwin.domain.powerflow.EjmlSparseLuSolver;
import dev.gridtwin.domain.powerflow.PowerFlow;
import dev.gridtwin.domain.powerflow.PowerFlowOptions;
import dev.gridtwin.domain.powerflow.PowerFlowResult;
import dev.gridtwin.domain.topology.NetworkTopology;
import dev.gridtwin.domain.twin.TwinSolver;
import dev.gridtwin.validation.contingency.N1Reference;
import dev.gridtwin.validation.contingency.N1Reference.OutageSolution;
import dev.gridtwin.validation.contingency.N1References;
import dev.gridtwin.validation.reference.ReferenceSolution;
import dev.gridtwin.validation.reference.ReferenceSolution.BranchSolution;
import dev.gridtwin.validation.reference.ReferenceSolution.BusSolution;
import dev.gridtwin.validation.reference.ReferenceSolutions;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ValidationReportTest {

    private static final double VOLTAGE_TOLERANCE_PU = 1e-6;
    private static final double ANGLE_TOLERANCE_DEGREES = 1e-4;
    private static final double FLOW_TOLERANCE_MW = 1e-2;
    private static final List<String> CASES = List.of("ieee14", "ieee30");
    private static final List<Double> LOAD_FACTORS = List.of(0.5, 1.0, 1.2, 1.5);
    private static final List<String> VARIANTS = List.of("plain", "qlim");

    @Test
    void theReportOfTheWorstDeviationsFromMatpowerIsWritten() throws IOException {
        List<Map<String, Object>> sets = new ArrayList<>();
        for (String caseId : CASES) {
            for (double loadFactor : LOAD_FACTORS) {
                for (String variant : VARIANTS) {
                    sets.add(compareBaseCase(caseId, loadFactor, variant));
                }
            }
        }
        List<Map<String, Object>> contingencies = new ArrayList<>();
        for (String caseId : CASES) {
            for (String variant : VARIANTS) {
                contingencies.add(compareContingencies(caseId, variant));
            }
        }

        Map<String, Object> report = new LinkedHashMap<>();
        report.put("suite", "validation");
        report.put("generatedAt", ZonedDateTime.now().toString());
        report.put("reference", "MATPOWER 8.1 under GNU Octave 11.3.0");
        report.put(
                "tolerances",
                Map.of(
                        "voltagePu", VOLTAGE_TOLERANCE_PU,
                        "angleDegrees", ANGLE_TOLERANCE_DEGREES,
                        "flowMw", FLOW_TOLERANCE_MW));
        report.put("baseCases", sets);
        report.put("contingencies", contingencies);
        report.put("worstOverall", worst(sets, contingencies));
        report.put(
                "environment",
                Map.of(
                        "jvm",
                                System.getProperty("java.vm.name")
                                        + " "
                                        + System.getProperty("java.runtime.version"),
                        "operatingSystem",
                                System.getProperty("os.name")
                                        + " "
                                        + System.getProperty("os.version"),
                        "logicalCores", Runtime.getRuntime().availableProcessors()));

        Path target = Path.of("target", "validation-report.json");
        Files.createDirectories(target.getParent());
        new ObjectMapper()
                .enable(SerializationFeature.INDENT_OUTPUT)
                .writeValue(target.toFile(), report);

        Map<String, Object> worst = worst(sets, contingencies);
        assertThat((double) worst.get("voltagePu")).isLessThanOrEqualTo(VOLTAGE_TOLERANCE_PU);
        assertThat((double) worst.get("angleDegrees")).isLessThanOrEqualTo(ANGLE_TOLERANCE_DEGREES);
        assertThat((double) worst.get("flowMw")).isLessThanOrEqualTo(FLOW_TOLERANCE_MW);
    }

    private static Map<String, Object> worst(
            List<Map<String, Object>> sets, List<Map<String, Object>> contingencies) {
        List<Map<String, Object>> all = new ArrayList<>(sets);
        all.addAll(contingencies);
        Map<String, Object> worst = new LinkedHashMap<>();
        for (String measure : List.of("voltagePu", "angleDegrees", "flowMw")) {
            worst.put(
                    measure,
                    all.stream()
                            .mapToDouble(entry -> (double) entry.get(measure))
                            .max()
                            .orElse(0.0));
        }
        return worst;
    }

    private static Map<String, Object> compareBaseCase(
            String caseId, double loadFactor, String variant) {
        ReferenceSolution reference = ReferenceSolutions.load(caseId, loadFactor, variant);
        PowerFlow powerFlow =
                new PowerFlow(
                        PowerFlowOptions.standard().withReactiveLimits(reference.enforceQLimits()),
                        EjmlSparseLuSolver::new);
        PowerFlowResult result =
                powerFlow.solve(CaseLoader.load(caseId).network().withLoadFactor(loadFactor));

        double voltage = 0.0;
        double angle = 0.0;
        for (BusSolution expected : reference.buses()) {
            BusResult actual = result.bus(expected.number()).orElseThrow();
            voltage = Math.max(voltage, Math.abs(actual.voltageMagnitude() - expected.vm()));
            angle = Math.max(angle, Math.abs(actual.angleDegrees() - expected.vaDegrees()));
        }
        double flow = 0.0;
        for (BranchSolution expected : reference.branches()) {
            BranchResult actual = result.branch(expected.id()).orElseThrow();
            flow = Math.max(flow, Math.abs(actual.activeFromMw() - expected.pFromMw()));
            flow = Math.max(flow, Math.abs(actual.reactiveFromMvar() - expected.qFromMvar()));
            flow = Math.max(flow, Math.abs(actual.activeToMw() - expected.pToMw()));
            flow = Math.max(flow, Math.abs(actual.reactiveToMvar() - expected.qToMvar()));
        }
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("case", caseId);
        entry.put("loadFactor", loadFactor);
        entry.put("reactiveLimits", reference.enforceQLimits());
        entry.put("iterations", result.iterations());
        entry.put("finalMismatchPu", result.finalMismatch());
        entry.put("voltagePu", voltage);
        entry.put("angleDegrees", angle);
        entry.put("flowMw", flow);
        return entry;
    }

    private static Map<String, Object> compareContingencies(String caseId, String variant) {
        N1Reference reference = N1References.load(caseId, variant);
        TwinSolver solver =
                new TwinSolver(
                        new PowerFlow(
                                PowerFlowOptions.standard()
                                        .withReactiveLimits(reference.enforceQLimits()),
                                EjmlSparseLuSolver::new));
        NetworkTopology source = new NetworkTopology(CaseLoader.load(caseId).network());
        ContingencyReport report =
                new ContingencyAnalysis(solver, ContingencyOptions.standard())
                        .run(source, solver.solve(source.topology()));

        double voltage = 0.0;
        double angle = 0.0;
        double flow = 0.0;
        int compared = 0;
        for (OutageSolution expected : reference.outages()) {
            if (!expected.hasSolution()) {
                continue;
            }
            compared++;
            var actual = report.find(expected.outageId()).orElseThrow().solution();
            BusSolution expectedReference =
                    expected.buses().stream()
                            .filter(bus -> bus.number() == expected.referenceBus())
                            .findFirst()
                            .orElseThrow();
            double actualReferenceAngle =
                    actual.bus(expected.referenceBus()).orElseThrow().angleDegrees();
            for (BusSolution bus : expected.buses()) {
                BusResult result = actual.bus(bus.number()).orElseThrow();
                voltage = Math.max(voltage, Math.abs(result.voltageMagnitude() - bus.vm()));
                double expectedDifference = bus.vaDegrees() - expectedReference.vaDegrees();
                double actualDifference = result.angleDegrees() - actualReferenceAngle;
                angle = Math.max(angle, Math.abs(actualDifference - expectedDifference));
            }
            for (BranchSolution branch : expected.branches()) {
                BranchResult result = actual.branch(branch.id()).orElseThrow();
                flow = Math.max(flow, Math.abs(result.activeFromMw() - branch.pFromMw()));
                flow = Math.max(flow, Math.abs(result.reactiveFromMvar() - branch.qFromMvar()));
                flow = Math.max(flow, Math.abs(result.activeToMw() - branch.pToMw()));
            }
        }
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("case", caseId);
        entry.put("reactiveLimits", reference.enforceQLimits());
        entry.put("outagesCompared", compared);
        entry.put("voltagePu", voltage);
        entry.put("angleDegrees", angle);
        entry.put("flowMw", flow);
        return entry;
    }
}
