package dev.gridtwin.domain.powerflow;

import dev.gridtwin.domain.model.BusType;

public record BusResult(
        int number,
        BusType type,
        BusState state,
        double voltageMagnitude,
        double angleDegrees,
        double activeGenerationMw,
        double reactiveGenerationMvar,
        double activeLoadMw,
        double reactiveLoadMvar) {

    public boolean energized() {
        return this.state == BusState.ENERGIZED;
    }
}
