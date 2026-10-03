package dev.gridtwin.bench;

import java.util.List;

public record Report(
        String suite,
        String generatedAt,
        Hardware hardware,
        Settings settings,
        List<Measurement> measurements,
        List<Target> targets) {

    public Report {
        measurements = List.copyOf(measurements);
        targets = List.copyOf(targets);
    }
}
