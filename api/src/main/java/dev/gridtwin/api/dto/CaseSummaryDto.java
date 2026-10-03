package dev.gridtwin.api.dto;

import dev.gridtwin.cases.CaseData;

public record CaseSummaryDto(String id, String title, int buses, int branches, int generators) {

    public static CaseSummaryDto from(CaseData data) {
        return new CaseSummaryDto(
                data.id(),
                data.title(),
                data.network().buses().size(),
                data.network().branches().size(),
                data.network().generators().size());
    }
}
