package dev.gridtwin.domain.powerflow;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public record PowerFlowResult(
        PowerFlowStatus status,
        Optional<CollapseReason> collapseReason,
        int iterations,
        int reactiveLimitRounds,
        List<Double> mismatchHistory,
        List<BusResult> buses,
        List<BranchResult> branches,
        List<GeneratorResult> generators,
        int slackBus,
        double slackActiveMw,
        double slackReactiveMvar,
        double totalLoadMw,
        double unservedLoadMw,
        double totalGenerationMw,
        double totalLossMw,
        double shuntConsumptionMw,
        List<String> warnings) {

    public PowerFlowResult {
        mismatchHistory = List.copyOf(mismatchHistory);
        buses = List.copyOf(buses);
        branches = List.copyOf(branches);
        generators = List.copyOf(generators);
        warnings = List.copyOf(warnings);
    }

    public boolean converged() {
        return this.status == PowerFlowStatus.CONVERGED;
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

    public double maxLoading() {
        return this.branches.stream().mapToDouble(BranchResult::loading).max().orElse(0.0);
    }

    public double finalMismatch() {
        return this.mismatchHistory.isEmpty()
                ? Double.NaN
                : this.mismatchHistory.get(this.mismatchHistory.size() - 1);
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
