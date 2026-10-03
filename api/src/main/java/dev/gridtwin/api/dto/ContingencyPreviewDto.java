package dev.gridtwin.api.dto;

import dev.gridtwin.domain.application.AnalysisRecord;
import dev.gridtwin.domain.contingency.ContingencyResult;

public record ContingencyPreviewDto(
        long stateVersion, ContingencySummaryDto contingency, StateDto state) {

    public static ContingencyPreviewDto from(AnalysisRecord<ContingencyResult> record) {
        return new ContingencyPreviewDto(
                record.version(),
                ContingencySummaryDto.from(record.result()),
                StateDto.from(record.state(), record.result().solution()));
    }
}
