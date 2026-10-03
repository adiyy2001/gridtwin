package dev.gridtwin.domain.powerflow;

import java.util.List;
import java.util.Optional;

record NewtonOutcome(
        Optional<CollapseReason> failure,
        int iterations,
        List<Double> mismatchHistory,
        double[] magnitudes,
        double[] anglesRadians) {

    boolean converged() {
        return this.failure.isEmpty();
    }
}
