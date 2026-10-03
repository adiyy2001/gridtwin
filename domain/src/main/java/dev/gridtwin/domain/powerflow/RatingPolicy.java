package dev.gridtwin.domain.powerflow;

import dev.gridtwin.domain.model.Branch;
import dev.gridtwin.domain.model.Network;

public record RatingPolicy(double headroomFactor, double stepMva, double floorMva) {

    public RatingPolicy {
        if (headroomFactor < 1.0 || stepMva <= 0 || floorMva <= 0) {
            throw new IllegalArgumentException("rating policy parameters are out of range");
        }
    }

    public static RatingPolicy standard() {
        return new RatingPolicy(1.25, 5.0, 20.0);
    }

    public double ratingFor(double peakApparentPowerMva) {
        double stepped =
                Math.ceil(this.headroomFactor * peakApparentPowerMva / this.stepMva) * this.stepMva;
        return Math.max(stepped, this.floorMva);
    }

    public Network applyTo(Network network, PowerFlowResult baseCase) {
        return network.withBranches(
                network.branches().stream().map(branch -> this.rated(branch, baseCase)).toList());
    }

    private Branch rated(Branch branch, PowerFlowResult baseCase) {
        return baseCase.branch(branch.id())
                .map(result -> branch.withRating(this.ratingFor(result.apparentPowerMva())))
                .orElse(branch);
    }
}
