package dev.gridtwin.api.dto;

import dev.gridtwin.domain.application.AnalysisRecord;
import dev.gridtwin.domain.cascade.CascadeEnd;
import dev.gridtwin.domain.cascade.CascadeResult;
import dev.gridtwin.domain.cascade.CascadeStep;
import dev.gridtwin.domain.twin.TwinState;
import java.util.List;
import java.util.Optional;

public record CascadeDto(
        long stateVersion,
        double tripThreshold,
        CascadeEnd end,
        int trippedCount,
        String label,
        List<CascadeStepDto> steps) {

    public static final String LABEL =
            "Educational simplification: the worst branch above the threshold trips, the network"
                    + " is solved again, and this repeats until it is stable or dark. No protection"
                    + " timing, no dynamics.";

    public static CascadeDto from(AnalysisRecord<CascadeResult> record) {
        CascadeResult result = record.result();
        return new CascadeDto(
                record.version(),
                result.tripThreshold(),
                result.end(),
                result.trippedCount(),
                LABEL,
                result.steps().stream()
                        .map(step -> CascadeStepDto.from(step, record.state()))
                        .toList());
    }

    public record CascadeStepDto(
            int index,
            Optional<ContingencySummaryDto.OutageDto> tripped,
            Optional<Double> loadingAtTrip,
            List<String> outOfServiceBranches,
            List<String> outOfServiceGenerators,
            double servedLoadMw,
            StateDto state) {

        static CascadeStepDto from(CascadeStep step, TwinState state) {
            return new CascadeStepDto(
                    step.index(),
                    step.tripped().map(ContingencySummaryDto.OutageDto::from),
                    step.loadingAtTrip().map(Numbers::finite),
                    List.copyOf(step.outages().branchIds()),
                    List.copyOf(step.outages().generatorIds()),
                    Numbers.finite(step.servedLoadMw()),
                    StateDto.from(state, step.solution()));
        }
    }
}
