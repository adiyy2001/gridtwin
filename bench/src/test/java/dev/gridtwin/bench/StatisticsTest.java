package dev.gridtwin.bench;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

import org.junit.jupiter.api.Test;

class StatisticsTest {

    private static final long MILLI = 1_000_000L;

    @Test
    void medianAndPercentileInterpolateBetweenSamples() {
        long[] nanos = new long[100];
        for (int index = 0; index < nanos.length; index++) {
            nanos[index] = (index + 1) * MILLI;
        }

        Statistics statistics = Statistics.ofNanos(nanos);

        assertThat(statistics.samples()).isEqualTo(100);
        assertThat(statistics.medianMs()).isCloseTo(50.5, within(1e-9));
        assertThat(statistics.p95Ms()).isCloseTo(95.05, within(1e-9));
        assertThat(statistics.minMs()).isCloseTo(1.0, within(1e-9));
        assertThat(statistics.maxMs()).isCloseTo(100.0, within(1e-9));
        assertThat(statistics.meanMs()).isCloseTo(50.5, within(1e-9));
    }

    @Test
    void theOrderOfTheSamplesDoesNotMatterAndTheInputIsLeftAlone() {
        long[] nanos = {5 * MILLI, 1 * MILLI, 3 * MILLI};

        Statistics statistics = Statistics.ofNanos(nanos);

        assertThat(statistics.medianMs()).isCloseTo(3.0, within(1e-9));
        assertThat(nanos).containsExactly(5 * MILLI, 1 * MILLI, 3 * MILLI);
    }

    @Test
    void aSingleSampleIsEveryStatistic() {
        Statistics statistics = Statistics.ofNanos(new long[] {2 * MILLI});

        assertThat(statistics.medianMs()).isEqualTo(2.0);
        assertThat(statistics.p95Ms()).isEqualTo(2.0);
    }

    @Test
    void noSamplesAreRejected() {
        assertThatThrownBy(() -> Statistics.ofNanos(new long[0]))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
