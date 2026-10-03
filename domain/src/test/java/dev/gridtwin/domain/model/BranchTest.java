package dev.gridtwin.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class BranchTest {

    @Test
    void aPlainLineIsNotATransformer() {
        assertThat(
                        new Branch("L1-2", 1, 2, 0.02, 0.06, 0.03, 100.0, 1.0, 0.0, true)
                                .isTransformer())
                .isFalse();
    }

    @Test
    void anOffNominalTapOrAPhaseShiftMakesATransformer() {
        assertThat(new Branch("T1-2", 1, 2, 0.0, 0.2, 0.0, 40.0, 0.978, 0.0, true).isTransformer())
                .isTrue();
        assertThat(new Branch("T1-3", 1, 3, 0.0, 0.2, 0.0, 40.0, 1.0, 5.0, true).isTransformer())
                .isTrue();
    }

    @Test
    void rejectsInvalidParameters() {
        assertThatThrownBy(() -> new Branch("", 1, 2, 0.0, 0.1, 0.0, 10.0, 1.0, 0.0, true))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Branch("L1-1", 1, 1, 0.0, 0.1, 0.0, 10.0, 1.0, 0.0, true))
                .hasMessageContaining("to itself");
        assertThatThrownBy(() -> new Branch("L1-2", 1, 2, 0.0, 0.1, 0.0, 10.0, 0.0, 0.0, true))
                .hasMessageContaining("tap ratio");
        assertThatThrownBy(() -> new Branch("L1-2", 1, 2, 0.0, 0.1, 0.0, 0.0, 1.0, 0.0, true))
                .hasMessageContaining("rating");
        assertThatThrownBy(() -> new Branch("L1-2", 1, 2, 0.0, 0.0, 0.0, 10.0, 1.0, 0.0, true))
                .hasMessageContaining("series impedance");
    }

    @Test
    void copiesWithAnotherRatingOrServiceStateKeepEverythingElse() {
        Branch branch = new Branch("T1-2", 1, 2, 0.01, 0.2, 0.03, 40.0, 0.978, 2.0, true);

        Branch rated = branch.withRating(55.0);
        Branch open = branch.withInService(false);

        assertThat(rated)
                .isEqualTo(new Branch("T1-2", 1, 2, 0.01, 0.2, 0.03, 55.0, 0.978, 2.0, true));
        assertThat(open)
                .isEqualTo(new Branch("T1-2", 1, 2, 0.01, 0.2, 0.03, 40.0, 0.978, 2.0, false));
    }
}
