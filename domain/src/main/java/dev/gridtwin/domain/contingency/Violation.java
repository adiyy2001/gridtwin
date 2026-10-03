package dev.gridtwin.domain.contingency;

public sealed interface Violation
        permits Violation.BranchOverload,
                Violation.VoltageOutOfBand,
                Violation.SlackAboveLimit,
                Violation.LoadShed,
                Violation.IslandCollapse {

    enum Side {
        LOW,
        HIGH
    }

    record BranchOverload(String branchId, double loading) implements Violation {}

    record VoltageOutOfBand(int bus, double voltageMagnitude, Side side) implements Violation {}

    record SlackAboveLimit(String generatorId, double activeMw, double maxMw)
            implements Violation {}

    record LoadShed(double loadMw) implements Violation {}

    record IslandCollapse(String islandId) implements Violation {}
}
