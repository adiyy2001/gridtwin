package dev.gridtwin.domain.contingency;

public record ContingencyOptions(ViolationLimits limits, SeverityWeights weights) {

    public static ContingencyOptions standard() {
        return new ContingencyOptions(ViolationLimits.standard(), SeverityWeights.standard());
    }
}
