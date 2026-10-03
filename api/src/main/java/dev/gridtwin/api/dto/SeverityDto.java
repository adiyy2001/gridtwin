package dev.gridtwin.api.dto;

import dev.gridtwin.domain.contingency.Severity;
import dev.gridtwin.domain.contingency.SeverityTier;

public record SeverityDto(
        SeverityTier tier,
        double score,
        double overloadTerm,
        double voltageTerm,
        double shedTerm,
        double slackTerm) {

    public static SeverityDto from(Severity severity) {
        return new SeverityDto(
                severity.tier(),
                Numbers.finite(severity.score()),
                Numbers.finite(severity.overloadTerm()),
                Numbers.finite(severity.voltageTerm()),
                Numbers.finite(severity.shedTerm()),
                Numbers.finite(severity.slackTerm()));
    }
}
