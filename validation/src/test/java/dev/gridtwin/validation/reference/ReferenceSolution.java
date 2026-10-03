package dev.gridtwin.validation.reference;

import com.fasterxml.jackson.annotation.JsonProperty;
import dev.gridtwin.cases.Provenance;
import java.util.List;
import java.util.Optional;

public record ReferenceSolution(
        Provenance provenance,
        @JsonProperty("case") String caseId,
        String variant,
        double loadFactor,
        boolean enforceQLimits,
        boolean converged,
        int iterations,
        double baseMva,
        double totalLoadMw,
        double totalGenerationMw,
        double totalLossMw,
        List<BusSolution> buses,
        List<GeneratorSolution> generators,
        List<BranchSolution> branches) {

    public Optional<BusSolution> bus(int number) {
        return this.buses.stream().filter(bus -> bus.number() == number).findFirst();
    }

    public Optional<BranchSolution> branch(String id) {
        return this.branches.stream().filter(branch -> branch.id().equals(id)).findFirst();
    }

    public record BusSolution(
            int number, double vm, double vaDegrees, double pdMw, double qdMvar) {}

    public record GeneratorSolution(int bus, double pMw, double qMvar, String qLimit) {}

    public record BranchSolution(
            String id,
            int from,
            int to,
            double pFromMw,
            double qFromMvar,
            double pToMw,
            double qToMvar) {

        public double apparentPowerMva() {
            return Math.max(
                    Math.hypot(this.pFromMw, this.qFromMvar), Math.hypot(this.pToMw, this.qToMvar));
        }
    }
}
