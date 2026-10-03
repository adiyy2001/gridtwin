package dev.gridtwin.domain.contingency;

import dev.gridtwin.domain.topology.Outages;

public sealed interface Outage permits Outage.BranchOutage, Outage.GeneratorOutage {

    String id();

    String equipmentId();

    Outages addTo(Outages outages);

    record BranchOutage(String equipmentId) implements Outage {

        @Override
        public String id() {
            return "branch:" + this.equipmentId;
        }

        @Override
        public Outages addTo(Outages outages) {
            return outages.withBranch(this.equipmentId);
        }
    }

    record GeneratorOutage(String equipmentId) implements Outage {

        @Override
        public String id() {
            return "generator:" + this.equipmentId;
        }

        @Override
        public Outages addTo(Outages outages) {
            return outages.withGenerator(this.equipmentId);
        }
    }

    static Outage branch(String branchId) {
        return new BranchOutage(branchId);
    }

    static Outage generator(String generatorId) {
        return new GeneratorOutage(generatorId);
    }
}
