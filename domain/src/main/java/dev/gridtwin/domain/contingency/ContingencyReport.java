package dev.gridtwin.domain.contingency;

import dev.gridtwin.domain.twin.GridSolution;
import java.util.List;
import java.util.Optional;

public record ContingencyReport(
        GridSolution base,
        List<Violation> baseViolations,
        Severity baseSeverity,
        List<ContingencyResult> ranked) {

    public ContingencyReport {
        baseViolations = List.copyOf(baseViolations);
        ranked = List.copyOf(ranked);
    }

    public Optional<ContingencyResult> find(String outageId) {
        return this.ranked.stream().filter(result -> result.id().equals(outageId)).findFirst();
    }

    public long countIn(SeverityTier tier) {
        return this.ranked.stream().filter(result -> result.severity().tier() == tier).count();
    }
}
