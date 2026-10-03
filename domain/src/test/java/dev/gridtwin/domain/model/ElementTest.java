package dev.gridtwin.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

import org.junit.jupiter.api.Test;

class ElementTest {

    @Test
    void scalingALoadScalesActiveAndReactivePower() {
        Load scaled = new Load(4, 47.8, -3.9).scaled(1.5);
        assertThat(scaled.bus()).isEqualTo(4);
        assertThat(scaled.activePowerMw()).isCloseTo(71.7, within(1e-12));
        assertThat(scaled.reactivePowerMvar()).isCloseTo(-5.85, within(1e-12));
    }

    @Test
    void aBusRejectsAnInvertedVoltageBandAndANonPositiveNumber() {
        assertThatThrownBy(() -> new Bus(1, BusType.PQ, 132.0, 1.1, 0.9, 1.0, 0.0))
                .hasMessageContaining("voltage band");
        assertThatThrownBy(() -> new Bus(0, BusType.PQ, 132.0, 0.9, 1.1, 1.0, 0.0))
                .hasMessageContaining("positive");
        assertThatThrownBy(() -> new Bus(1, BusType.PQ, 0.0, 0.9, 1.1, 1.0, 0.0))
                .hasMessageContaining("base voltage");
    }

    @Test
    void aGeneratorRejectsInvertedRangesAndABlankId() {
        assertThatThrownBy(
                        () -> new Generator("G1", 1, 0.0, 0.0, 10.0, -10.0, 0.0, 100.0, 1.0, true))
                .hasMessageContaining("reactive range");
        assertThatThrownBy(
                        () -> new Generator("G1", 1, 0.0, 0.0, -10.0, 10.0, 100.0, 0.0, 1.0, true))
                .hasMessageContaining("active range");
        assertThatThrownBy(
                        () -> new Generator(" ", 1, 0.0, 0.0, -10.0, 10.0, 0.0, 100.0, 1.0, true))
                .hasMessageContaining("id");
    }
}
