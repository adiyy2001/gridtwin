package dev.gridtwin.domain.powerflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

import java.util.List;
import org.junit.jupiter.api.Test;

class ValueTypesTest {

    @Test
    void arithmeticFollowsComplexNumbers() {
        Admittance value = new Admittance(3.0, 4.0);

        assertThat(value.plus(new Admittance(1.0, -1.0))).isEqualTo(new Admittance(4.0, 3.0));
        assertThat(value.negated()).isEqualTo(new Admittance(-3.0, -4.0));
        assertThat(value.scaled(0.5)).isEqualTo(new Admittance(1.5, 2.0));
        assertThat(value.magnitude()).isEqualTo(5.0);
    }

    @Test
    void rotatingByAQuarterTurnMultipliesByJ() {
        Admittance rotated = new Admittance(3.0, 4.0).rotated(Math.PI / 2.0);

        assertThat(rotated.conductance()).isCloseTo(-4.0, within(1e-12));
        assertThat(rotated.susceptance()).isCloseTo(3.0, within(1e-12));
    }

    @Test
    void theBusIndexMapsNumbersToPositionsBothWays() {
        BusIndex index = BusIndex.of(List.of(10, 20, 30));

        assertThat(index.size()).isEqualTo(3);
        assertThat(index.numberAt(1)).isEqualTo(20);
        assertThat(index.positionOf(30)).contains(2);
        assertThat(index.positionOf(40)).isEmpty();
        assertThat(index.contains(10)).isTrue();
        assertThat(index.requirePosition(20)).isEqualTo(1);
    }

    @Test
    void askingForAnUnknownBusPositionFails() {
        BusIndex index = BusIndex.of(List.of(1));

        assertThatThrownBy(() -> index.requirePosition(9))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("9");
    }
}
