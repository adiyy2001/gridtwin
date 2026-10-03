package dev.gridtwin.domain.contingency;

import dev.gridtwin.domain.twin.GridSolution;
import java.util.List;

public record ContingencyResult(
        int rank,
        Outage outage,
        GridSolution solution,
        List<Violation> violations,
        Severity severity) {

    public ContingencyResult {
        violations = List.copyOf(violations);
    }

    public ContingencyResult withRank(int newRank) {
        return new ContingencyResult(
                newRank, this.outage, this.solution, this.violations, this.severity);
    }

    public String id() {
        return this.outage.id();
    }
}
