package dev.gridtwin.api.dto;

import dev.gridtwin.domain.contingency.Violation;
import java.util.Optional;

public record ViolationDto(
        ViolationKind kind,
        String subject,
        double value,
        Optional<Double> limit,
        Optional<String> side) {

    public enum ViolationKind {
        BRANCH_OVERLOAD,
        VOLTAGE_OUT_OF_BAND,
        SLACK_ABOVE_LIMIT,
        LOAD_SHED,
        ISLAND_COLLAPSE
    }

    public static ViolationDto from(Violation violation) {
        return switch (violation) {
            case Violation.BranchOverload overload ->
                    new ViolationDto(
                            ViolationKind.BRANCH_OVERLOAD,
                            overload.branchId(),
                            Numbers.finite(overload.loading()),
                            Optional.of(1.0),
                            Optional.empty());
            case Violation.VoltageOutOfBand band ->
                    new ViolationDto(
                            ViolationKind.VOLTAGE_OUT_OF_BAND,
                            String.valueOf(band.bus()),
                            Numbers.finite(band.voltageMagnitude()),
                            Optional.empty(),
                            Optional.of(band.side().name()));
            case Violation.SlackAboveLimit slack ->
                    new ViolationDto(
                            ViolationKind.SLACK_ABOVE_LIMIT,
                            slack.generatorId(),
                            Numbers.finite(slack.activeMw()),
                            Optional.of(slack.maxMw()),
                            Optional.empty());
            case Violation.LoadShed shed ->
                    new ViolationDto(
                            ViolationKind.LOAD_SHED,
                            "",
                            Numbers.finite(shed.loadMw()),
                            Optional.empty(),
                            Optional.empty());
            case Violation.IslandCollapse collapse ->
                    new ViolationDto(
                            ViolationKind.ISLAND_COLLAPSE,
                            collapse.islandId(),
                            0.0,
                            Optional.empty(),
                            Optional.empty());
        };
    }
}
