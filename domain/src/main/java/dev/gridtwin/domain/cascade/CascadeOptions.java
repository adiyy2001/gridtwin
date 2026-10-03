package dev.gridtwin.domain.cascade;

public record CascadeOptions(double tripThreshold, int maxSteps) {

    public CascadeOptions {
        if (!(tripThreshold > 0) || maxSteps < 1) {
            throw new IllegalArgumentException("cascade options are out of range");
        }
    }

    public static CascadeOptions standard() {
        return new CascadeOptions(1.2, 50);
    }
}
