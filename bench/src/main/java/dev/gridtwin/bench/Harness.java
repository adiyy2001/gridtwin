package dev.gridtwin.bench;

import java.util.function.Supplier;

public final class Harness {

    private static volatile Object sink;

    private final Settings settings;

    public Harness(Settings settings) {
        this.settings = settings;
    }

    public Measurement measure(String name, String description, Supplier<?> action) {
        for (int run = 0; run < this.settings.warmupRuns(); run++) {
            sink = action.get();
        }
        long[] nanos = new long[this.settings.measuredRuns()];
        for (int run = 0; run < nanos.length; run++) {
            long start = System.nanoTime();
            sink = action.get();
            nanos[run] = System.nanoTime() - start;
        }
        return new Measurement(
                name, description, this.settings.warmupRuns(), Statistics.ofNanos(nanos));
    }

    static Object lastResult() {
        return sink;
    }
}
