package dev.gridtwin.domain.powerflow;

public record PowerFlowOptions(double tolerance, int maxIterations, boolean enforceReactiveLimits) {

    public PowerFlowOptions {
        if (tolerance <= 0) {
            throw new IllegalArgumentException("tolerance must be positive");
        }
        if (maxIterations < 1) {
            throw new IllegalArgumentException("at least one iteration is needed");
        }
    }

    public static PowerFlowOptions standard() {
        return new PowerFlowOptions(1e-8, 20, true);
    }

    public PowerFlowOptions withReactiveLimits(boolean enforce) {
        return new PowerFlowOptions(this.tolerance, this.maxIterations, enforce);
    }
}
