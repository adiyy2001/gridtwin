package dev.gridtwin.domain.contingency;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

import java.util.List;
import org.junit.jupiter.api.Test;

class SeverityTest {

    private static Severity severity(SeverityTier tier, double score) {
        return new Severity(tier, score, 0.0, 0.0, 0.0, 0.0);
    }

    @Test
    void tiersDominateScores() {
        List<Severity> sorted =
                List.of(
                                severity(SeverityTier.SECURE, 0.0),
                                severity(SeverityTier.NON_CONVERGED, 0.1),
                                severity(SeverityTier.DEGRADED, 50.0),
                                severity(SeverityTier.BLACKOUT, 1.0),
                                severity(SeverityTier.DEGRADED, 2.0))
                        .stream()
                        .sorted(Severity.MOST_SEVERE_FIRST)
                        .toList();

        assertThat(sorted.stream().map(Severity::tier))
                .containsExactly(
                        SeverityTier.NON_CONVERGED,
                        SeverityTier.BLACKOUT,
                        SeverityTier.DEGRADED,
                        SeverityTier.DEGRADED,
                        SeverityTier.SECURE);
        assertThat(sorted.get(2).score()).isEqualTo(50.0);
    }

    @Test
    void limitsAndWeightsRejectNonsense() {
        assertThatThrownBy(() -> new ViolationLimits(0.0, 0.9, 1.1))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new ViolationLimits(1.0, 1.1, 0.9))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new SeverityWeights(-1.0, 1.0, 1.0, 1.0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(ViolationLimits.standard().halfBand()).isCloseTo(0.1, within(1e-12));
    }
}
