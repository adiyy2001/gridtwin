package dev.gridtwin.api.dto;

import dev.gridtwin.domain.application.TwinFailure;
import dev.gridtwin.domain.topology.Refusal;
import java.util.Optional;

public record ErrorDto(String code, String message, Optional<String> switchId) {

    public static ErrorDto of(String code, String message) {
        return new ErrorDto(code, message, Optional.empty());
    }

    public static ErrorDto from(TwinFailure failure) {
        Optional<String> switchId =
                switch (failure) {
                    case TwinFailure.OperationRefused refused ->
                            Optional.of(refused.refusal().switchId());
                    case TwinFailure.UnknownSwitch unknown -> Optional.of(unknown.switchId());
                    default -> Optional.empty();
                };
        return new ErrorDto(failure.code(), failure.message(), switchId);
    }

    public static ErrorDto from(Refusal refusal) {
        return new ErrorDto(refusal.code(), refusal.message(), Optional.of(refusal.switchId()));
    }
}
