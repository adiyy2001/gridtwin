package dev.gridtwin.domain.powerflow;

import java.util.Map;

public record WarmStart(Map<Integer, Double> magnitudes, Map<Integer, Double> anglesDegrees) {

    public WarmStart {
        magnitudes = Map.copyOf(magnitudes);
        anglesDegrees = Map.copyOf(anglesDegrees);
    }
}
