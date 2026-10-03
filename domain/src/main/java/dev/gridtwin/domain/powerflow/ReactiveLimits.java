package dev.gridtwin.domain.powerflow;

import dev.gridtwin.domain.model.BusType;
import java.util.LinkedHashMap;
import java.util.Map;

final class ReactiveLimits {

    private static final double VIOLATION_TOLERANCE_MVAR = 5e-6;

    private ReactiveLimits() {}

    static Map<Integer, ReactiveLimitState> newViolations(
            IslandModel model, PowerFlowProblem problem, NewtonOutcome outcome) {
        Injections injections =
                model.ybus().injections(outcome.magnitudes(), outcome.anglesRadians());
        double tolerance = VIOLATION_TOLERANCE_MVAR / model.network().baseMva();
        Map<Integer, ReactiveLimitState> violations = new LinkedHashMap<>();
        for (int position = 0; position < problem.roles().length; position++) {
            if (problem.roles()[position] != BusType.PV) {
                continue;
            }
            double generation = injections.reactivePower()[position] + model.loadReactive(position);
            if (generation > model.reactiveMax(position) + tolerance) {
                violations.put(position, ReactiveLimitState.UPPER);
            } else if (generation < model.reactiveMin(position) - tolerance) {
                violations.put(position, ReactiveLimitState.LOWER);
            }
        }
        return violations;
    }
}
