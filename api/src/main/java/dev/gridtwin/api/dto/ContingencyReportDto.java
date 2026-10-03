package dev.gridtwin.api.dto;

import dev.gridtwin.domain.application.AnalysisRecord;
import dev.gridtwin.domain.contingency.ContingencyReport;
import dev.gridtwin.domain.contingency.SeverityTier;
import java.util.List;

public record ContingencyReportDto(
        long stateVersion,
        double loadFactor,
        SeverityDto baseSeverity,
        List<ViolationDto> baseViolations,
        TierCountsDto tiers,
        List<ContingencySummaryDto> contingencies) {

    public static ContingencyReportDto from(AnalysisRecord<ContingencyReport> record) {
        ContingencyReport report = record.result();
        return new ContingencyReportDto(
                record.version(),
                record.state().loadFactor(),
                SeverityDto.from(report.baseSeverity()),
                report.baseViolations().stream().map(ViolationDto::from).toList(),
                new TierCountsDto(
                        report.countIn(SeverityTier.SECURE),
                        report.countIn(SeverityTier.DEGRADED),
                        report.countIn(SeverityTier.BLACKOUT),
                        report.countIn(SeverityTier.NON_CONVERGED)),
                report.ranked().stream().map(ContingencySummaryDto::from).toList());
    }

    public record TierCountsDto(long secure, long degraded, long blackout, long nonConverged) {}
}
