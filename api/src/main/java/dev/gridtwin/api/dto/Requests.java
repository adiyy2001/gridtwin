package dev.gridtwin.api.dto;

import dev.gridtwin.domain.topology.Position;
import jakarta.validation.constraints.NotNull;
import java.util.Optional;

public final class Requests {

    private Requests() {}

    public record CreateSession(Optional<String> caseId) {}

    public record OperateSwitch(@NotNull Position position) {}

    public record SetLoadFactor(@NotNull Double loadFactor) {}

    public record RunCascade(
            @NotNull String trigger, Optional<Double> tripThreshold, Optional<Integer> maxSteps) {}
}
