package dev.gridtwin.domain.cascade;

import java.util.List;

public record CascadeResult(double tripThreshold, List<CascadeStep> steps, CascadeEnd end) {

    public CascadeResult {
        steps = List.copyOf(steps);
    }

    public CascadeStep last() {
        return this.steps.get(this.steps.size() - 1);
    }

    public int trippedCount() {
        return (int) this.steps.stream().filter(step -> step.tripped().isPresent()).count();
    }
}
