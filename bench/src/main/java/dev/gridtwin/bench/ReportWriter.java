package dev.gridtwin.bench;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;

public final class ReportWriter {

    private static final ObjectMapper MAPPER =
            new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);

    private ReportWriter() {}

    public static Path write(Report report, Path directory) throws IOException {
        Files.createDirectories(directory);
        Path file = directory.resolve(report.suite() + ".json");
        Files.writeString(file, MAPPER.writeValueAsString(report) + "\n");
        return file;
    }

    public static String format(Report report) {
        StringBuilder text = new StringBuilder();
        text.append("gridtwin benchmark: ").append(report.suite()).append('\n');
        text.append("generated at: ").append(report.generatedAt()).append('\n');
        text.append("hardware: ").append(report.hardware().describe()).append('\n');
        text.append(
                String.format(
                        Locale.ROOT,
                        "runs: %d warm-up, %d measured%n",
                        report.settings().warmupRuns(),
                        report.settings().measuredRuns()));
        text.append(
                String.format(
                        Locale.ROOT,
                        "%-44s %10s %10s %10s %10s%n",
                        "measurement",
                        "median ms",
                        "p95 ms",
                        "min ms",
                        "max ms"));
        for (Measurement measurement : report.measurements()) {
            Statistics statistics = measurement.statistics();
            text.append(
                    String.format(
                            Locale.ROOT,
                            "%-44s %10.3f %10.3f %10.3f %10.3f%n",
                            measurement.name(),
                            statistics.medianMs(),
                            statistics.p95Ms(),
                            statistics.minMs(),
                            statistics.maxMs()));
        }
        for (Target target : report.targets()) {
            text.append(
                    String.format(
                            Locale.ROOT,
                            "target %-34s p95 %.3f ms against %.0f ms: %s%n",
                            target.name(),
                            target.actualP95Ms(),
                            target.limitMs(),
                            target.met() ? "met" : "NOT met"));
        }
        return text.toString();
    }
}
