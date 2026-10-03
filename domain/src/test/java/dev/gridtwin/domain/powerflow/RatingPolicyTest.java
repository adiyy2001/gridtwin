package dev.gridtwin.domain.powerflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.gridtwin.domain.model.Network;
import java.util.List;
import org.junit.jupiter.api.Test;

class RatingPolicyTest {

    private final RatingPolicy policy = RatingPolicy.standard();

    @Test
    void theStandardPolicyIsOneTwentyFivePercentRoundedUpToFiveWithAFloorOfTwenty() {
        assertThat(this.policy.headroomFactor()).isEqualTo(1.25);
        assertThat(this.policy.stepMva()).isEqualTo(5.0);
        assertThat(this.policy.floorMva()).isEqualTo(20.0);
    }

    @Test
    void smallFlowsGetTheFloor() {
        assertThat(this.policy.ratingFor(0.0)).isEqualTo(20.0);
        assertThat(this.policy.ratingFor(10.0)).isEqualTo(20.0);
        assertThat(this.policy.ratingFor(16.0)).isEqualTo(20.0);
    }

    @Test
    void largerFlowsGetOneTwentyFivePercentRoundedUpToTheStep() {
        assertThat(this.policy.ratingFor(40.0)).isEqualTo(50.0);
        assertThat(this.policy.ratingFor(100.0)).isEqualTo(125.0);
        assertThat(this.policy.ratingFor(101.0)).isEqualTo(130.0);
    }

    @Test
    void ratingsFollowTheFlowsOfABaseCase() {
        Network network = TestNetworks.threeBus(1000.0);
        PowerFlowResult baseCase = PowerFlow.standard().solve(network);

        Network rated = this.policy.applyTo(network, baseCase);

        for (BranchResult branch : baseCase.branches()) {
            assertThat(rated.findBranch(branch.id()).orElseThrow().ratingMva())
                    .isEqualTo(this.policy.ratingFor(branch.apparentPowerMva()));
        }
        assertThat(PowerFlow.standard().solve(rated).maxLoading())
                .isLessThanOrEqualTo(1.0 / 1.25 + 1e-9);
    }

    @Test
    void branchesMissingFromTheBaseCaseKeepTheirRating() {
        Network network = TestNetworks.threeBus(1000.0);
        Network other = TestNetworks.twoBus(10.0, 0.0, 0.0, 0.1);
        PowerFlowResult unrelated =
                PowerFlow.standard()
                        .solve(other.withBranches(List.of(TestNetworks.line("X", 1, 2, 0.0, 0.1))));

        Network rated = this.policy.applyTo(network, unrelated);

        assertThat(rated.branches().stream().map(branch -> branch.ratingMva()).toList())
                .containsExactlyElementsOf(List.of(200.0, 200.0, 200.0));
    }

    @Test
    void invalidParametersAreRejected() {
        assertThatThrownBy(() -> new RatingPolicy(0.9, 5.0, 20.0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new RatingPolicy(1.25, 0.0, 20.0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new RatingPolicy(1.25, 5.0, 0.0))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
