package dev.gridtwin.domain.contingency;

public record SeverityWeights(double overload, double voltage, double shedLoad, double slack) {

    public SeverityWeights {
        if (overload < 0 || voltage < 0 || shedLoad < 0 || slack < 0) {
            throw new IllegalArgumentException("severity weights must not be negative");
        }
    }

    public static SeverityWeights standard() {
        return new SeverityWeights(1.0, 1.0, 10.0, 1.0);
    }
}
