package dev.gridtwin.api.dto;

import dev.gridtwin.domain.contingency.ContingencyResult;
import dev.gridtwin.domain.contingency.Outage;
import dev.gridtwin.domain.powerflow.BranchResult;
import java.util.List;
import java.util.Optional;

public record ContingencySummaryDto(
        int rank,
        String id,
        OutageDto outage,
        SeverityDto severity,
        boolean converged,
        double maxLoading,
        Optional<Double> lowestVoltage,
        double shedLoadMw,
        List<String> overloadedBranches,
        List<ViolationDto> violations) {

    public static ContingencySummaryDto from(ContingencyResult result) {
        return new ContingencySummaryDto(
                result.rank(),
                result.id(),
                OutageDto.from(result.outage()),
                SeverityDto.from(result.severity()),
                result.solution().converged(),
                Numbers.finite(result.solution().maxLoading()),
                result.solution().lowestVoltage().isPresent()
                        ? Optional.of(result.solution().lowestVoltage().getAsDouble())
                        : Optional.empty(),
                Numbers.finite(result.solution().shedLoadMw()),
                result.solution().overloadedBranches().stream().map(BranchResult::id).toList(),
                result.violations().stream().map(ViolationDto::from).toList());
    }

    public enum OutageKind {
        BRANCH,
        GENERATOR
    }

    public record OutageDto(String id, OutageKind kind, String equipmentId) {

        public static OutageDto from(Outage outage) {
            OutageKind kind =
                    outage instanceof Outage.BranchOutage
                            ? OutageKind.BRANCH
                            : OutageKind.GENERATOR;
            return new OutageDto(outage.id(), kind, outage.equipmentId());
        }
    }
}
