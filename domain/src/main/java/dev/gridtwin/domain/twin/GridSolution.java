package dev.gridtwin.domain.twin;

import dev.gridtwin.domain.powerflow.BranchResult;
import dev.gridtwin.domain.powerflow.BusResult;
import dev.gridtwin.domain.powerflow.GeneratorResult;
import dev.gridtwin.domain.powerflow.WarmStart;
import dev.gridtwin.domain.topology.Topology;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalDouble;

public record GridSolution(
        Topology topology,
        List<IslandSolution> islands,
        List<BusResult> buses,
        List<BranchResult> branches,
        List<GeneratorResult> generators,
        double totalLoadMw,
        double shedLoadMw,
        double totalGenerationMw,
        double totalLossMw,
        List<String> warnings) {

    public GridSolution {
        islands = List.copyOf(islands);
        buses = List.copyOf(buses);
        branches = List.copyOf(branches);
        generators = List.copyOf(generators);
        warnings = List.copyOf(warnings);
    }

    public boolean converged() {
        return this.islands.stream().noneMatch(island -> island.state() == IslandState.COLLAPSED);
    }

    public Optional<BusResult> bus(int number) {
        return this.buses.stream().filter(bus -> bus.number() == number).findFirst();
    }

    public Optional<BranchResult> branch(String id) {
        return this.branches.stream().filter(branch -> branch.id().equals(id)).findFirst();
    }

    public Optional<GeneratorResult> generator(String id) {
        return this.generators.stream().filter(generator -> generator.id().equals(id)).findFirst();
    }

    public Optional<IslandSolution> islandOf(int busNumber) {
        return this.islands.stream()
                .filter(island -> island.island().contains(busNumber))
                .findFirst();
    }

    public double maxLoading() {
        return this.branches.stream().mapToDouble(BranchResult::loading).max().orElse(0.0);
    }

    public List<BranchResult> overloadedBranches() {
        return this.branches.stream().filter(BranchResult::overloaded).toList();
    }

    public OptionalDouble lowestVoltage() {
        return this.buses.stream()
                .filter(BusResult::energized)
                .mapToDouble(BusResult::voltageMagnitude)
                .min();
    }

    public WarmStart warmStart() {
        Map<Integer, Double> magnitudes = new HashMap<>();
        Map<Integer, Double> angles = new HashMap<>();
        this.buses.stream()
                .filter(BusResult::energized)
                .forEach(
                        bus -> {
                            magnitudes.put(bus.number(), bus.voltageMagnitude());
                            angles.put(bus.number(), bus.angleDegrees());
                        });
        return new WarmStart(magnitudes, angles);
    }
}
