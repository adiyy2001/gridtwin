package dev.gridtwin.domain.twin;

import dev.gridtwin.domain.powerflow.BranchResult;
import dev.gridtwin.domain.powerflow.BusResult;
import dev.gridtwin.domain.powerflow.GeneratorResult;
import dev.gridtwin.domain.powerflow.WarmStart;
import dev.gridtwin.domain.topology.Topology;
import java.util.List;
import java.util.Optional;
import java.util.OptionalDouble;

public record TwinSolution(TwinState state, GridSolution grid) {

    public Topology topology() {
        return this.grid.topology();
    }

    public List<IslandSolution> islands() {
        return this.grid.islands();
    }

    public List<BusResult> buses() {
        return this.grid.buses();
    }

    public List<BranchResult> branches() {
        return this.grid.branches();
    }

    public List<GeneratorResult> generators() {
        return this.grid.generators();
    }

    public double totalLoadMw() {
        return this.grid.totalLoadMw();
    }

    public double shedLoadMw() {
        return this.grid.shedLoadMw();
    }

    public double totalGenerationMw() {
        return this.grid.totalGenerationMw();
    }

    public double totalLossMw() {
        return this.grid.totalLossMw();
    }

    public List<String> warnings() {
        return this.grid.warnings();
    }

    public boolean converged() {
        return this.grid.converged();
    }

    public Optional<BusResult> bus(int number) {
        return this.grid.bus(number);
    }

    public Optional<BranchResult> branch(String id) {
        return this.grid.branch(id);
    }

    public Optional<GeneratorResult> generator(String id) {
        return this.grid.generator(id);
    }

    public Optional<IslandSolution> islandOf(int busNumber) {
        return this.grid.islandOf(busNumber);
    }

    public double maxLoading() {
        return this.grid.maxLoading();
    }

    public List<BranchResult> overloadedBranches() {
        return this.grid.overloadedBranches();
    }

    public OptionalDouble lowestVoltage() {
        return this.grid.lowestVoltage();
    }

    public WarmStart warmStart() {
        return this.grid.warmStart();
    }
}
