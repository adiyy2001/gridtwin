package dev.gridtwin.bench;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class HarnessTest {

    @Test
    void theActionRunsForTheWarmUpAndForEveryMeasuredRun() {
        AtomicInteger calls = new AtomicInteger();
        Harness harness = new Harness(new Settings(4, 6));

        Measurement measurement = harness.measure("count", "counts calls", calls::incrementAndGet);

        assertThat(calls).hasValue(10);
        assertThat(measurement.statistics().samples()).isEqualTo(6);
        assertThat(measurement.warmupRuns()).isEqualTo(4);
        assertThat(measurement.name()).isEqualTo("count");
        assertThat(Harness.lastResult()).isEqualTo(10);
    }

    @Test
    void settingsRejectNonsense() {
        assertThatThrownBy(() -> new Settings(-1, 5)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Settings(1, 0)).isInstanceOf(IllegalArgumentException.class);
        assertThat(Settings.standard().measuredRuns())
                .isGreaterThan(Settings.quick().measuredRuns());
    }

    @Test
    void aTargetIsMetWhenTheNinetyFifthPercentileIsBelowTheLimit() {
        Statistics fast = new Statistics(10, 1.0, 2.0, 1.2, 0.9, 3.0);
        Measurement measurement = new Measurement("solve", "a solve", 5, fast);

        assertThat(Target.p95Below("solve", measurement, 10.0).met()).isTrue();
        assertThat(Target.p95Below("solve", measurement, 2.0).met()).isFalse();
        assertThat(Target.p95Below("solve", measurement, 10.0).actualP95Ms()).isEqualTo(2.0);
    }
}
