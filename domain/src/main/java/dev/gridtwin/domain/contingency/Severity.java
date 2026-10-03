package dev.gridtwin.domain.contingency;

import java.util.Comparator;

public record Severity(
        SeverityTier tier,
        double score,
        double overloadTerm,
        double voltageTerm,
        double shedTerm,
        double slackTerm) {

    public static final Comparator<Severity> MOST_SEVERE_FIRST =
            Comparator.comparing(Severity::tier).thenComparingDouble(Severity::score).reversed();
}
