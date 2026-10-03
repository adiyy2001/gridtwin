package dev.gridtwin.bench;

import java.util.Arrays;

public record Statistics(
        int samples, double medianMs, double p95Ms, double meanMs, double minMs, double maxMs) {

    private static final double NANOS_PER_MILLI = 1_000_000.0;

    public static Statistics ofNanos(long[] nanos) {
        if (nanos.length == 0) {
            throw new IllegalArgumentException("no samples");
        }
        long[] sorted = nanos.clone();
        Arrays.sort(sorted);
        double mean = Arrays.stream(sorted).average().orElseThrow();
        return new Statistics(
                sorted.length,
                percentile(sorted, 0.50) / NANOS_PER_MILLI,
                percentile(sorted, 0.95) / NANOS_PER_MILLI,
                mean / NANOS_PER_MILLI,
                sorted[0] / NANOS_PER_MILLI,
                sorted[sorted.length - 1] / NANOS_PER_MILLI);
    }

    static double percentile(long[] sorted, double fraction) {
        double position = fraction * (sorted.length - 1);
        int lower = (int) Math.floor(position);
        int upper = (int) Math.ceil(position);
        return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
    }
}
