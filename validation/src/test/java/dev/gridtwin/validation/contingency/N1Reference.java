package dev.gridtwin.validation.contingency;

import com.fasterxml.jackson.annotation.JsonProperty;
import dev.gridtwin.cases.Provenance;
import dev.gridtwin.validation.reference.ReferenceSolution.BranchSolution;
import dev.gridtwin.validation.reference.ReferenceSolution.BusSolution;
import dev.gridtwin.validation.reference.ReferenceSolution.GeneratorSolution;
import java.util.List;
import java.util.Optional;

public record N1Reference(
        Provenance provenance,
        @JsonProperty("case") String caseId,
        String variant,
        double loadFactor,
        boolean enforceQLimits,
        String slackRule,
        List<OutageSolution> outages) {

    public N1Reference {
        outages = List.copyOf(outages);
    }

    public Optional<OutageSolution> find(String kind, String id) {
        return this.outages.stream()
                .filter(outage -> outage.kind().equals(kind) && outage.id().equals(id))
                .findFirst();
    }

    public record OutageSolution(
            String kind,
            String id,
            String status,
            Integer referenceBus,
            Integer iterations,
            Double totalLoadMw,
            Double totalGenerationMw,
            Double totalLossMw,
            List<BusSolution> buses,
            List<GeneratorSolution> generators,
            List<BranchSolution> branches) {

        public boolean solved() {
            return this.status.equals("solved");
        }

        public String outageId() {
            return this.kind + ":" + this.id;
        }
    }
}
