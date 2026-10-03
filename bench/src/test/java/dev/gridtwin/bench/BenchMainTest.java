package dev.gridtwin.bench;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class BenchMainTest {

    @TempDir Path directory;

    @Test
    void aQuickRunPrintsTheHardwareHeaderAndTheNumbersAndWritesTheResultsFile() throws IOException {
        ByteArrayOutputStream captured = new ByteArrayOutputStream();

        int code =
                BenchMain.run(
                        List.of("--quick", "--output", this.directory.toString()),
                        new PrintStream(captured, true, StandardCharsets.UTF_8));

        String text = captured.toString(StandardCharsets.UTF_8);
        assertThat(code).isZero();
        assertThat(text).contains("hardware: ", "logical cores", "ieee30 solve, warm start");
        assertThat(text)
                .contains("ieee30 N-1 sequential", "ieee14 cascade", "target IEEE 30 solve");
        Path file = this.directory.resolve("java.json");
        assertThat(file).exists();
        JsonNode json = new ObjectMapper().readTree(Files.readString(file));
        assertThat(json.get("suite").asText()).isEqualTo("java");
        assertThat(json.get("hardware").get("cpuModel").asText()).isNotBlank();
        assertThat(json.get("measurements").size()).isGreaterThan(10);
        assertThat(json.get("targets")).hasSize(3);
        assertThat(json.get("measurements").get(0).get("statistics").get("medianMs").asDouble())
                .isPositive();
    }

    @Test
    void theTextReportMarksAMissedTarget() {
        assertThat(ReportWriter.format(sampleReport())).contains("hardware: ", "NOT met");
    }

    private static Report sampleReport() {
        Statistics slow = new Statistics(3, 20.0, 30.0, 21.0, 19.0, 31.0);
        Measurement measurement = new Measurement("slow", "a slow thing", 2, slow);
        return new Report(
                "sample",
                "2026-10-03T12:00:00+02:00",
                Hardware.detect(),
                Settings.quick(),
                List.of(measurement),
                List.of(Target.p95Below("slow", measurement, 10.0)));
    }
}
