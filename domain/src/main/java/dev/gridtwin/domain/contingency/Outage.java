package dev.gridtwin.domain.contingency;

import dev.gridtwin.domain.topology.Outages;
import java.util.Optional;

public sealed interface Outage permits Outage.BranchOutage, Outage.GeneratorOutage {

    String BRANCH_PREFIX = "branch:";
    String GENERATOR_PREFIX = "generator:";

    String id();

    String equipmentId();

    Outages addTo(Outages outages);

    record BranchOutage(String equipmentId) implements Outage {

        @Override
        public String id() {
            return BRANCH_PREFIX + this.equipmentId;
        }

        @Override
        public Outages addTo(Outages outages) {
            return outages.withBranch(this.equipmentId);
        }
    }

    record GeneratorOutage(String equipmentId) implements Outage {

        @Override
        public String id() {
            return GENERATOR_PREFIX + this.equipmentId;
        }

        @Override
        public Outages addTo(Outages outages) {
            return outages.withGenerator(this.equipmentId);
        }
    }

    static Outage branch(String branchId) {
        return new BranchOutage(branchId);
    }

    static Optional<Outage> parse(String outageId) {
        if (outageId.startsWith(BRANCH_PREFIX)) {
            return Optional.of(branch(outageId.substring(BRANCH_PREFIX.length())));
        }
        if (outageId.startsWith(GENERATOR_PREFIX)) {
            return Optional.of(generator(outageId.substring(GENERATOR_PREFIX.length())));
        }
        return Optional.empty();
    }

    static Outage generator(String generatorId) {
        return new GeneratorOutage(generatorId);
    }
}
