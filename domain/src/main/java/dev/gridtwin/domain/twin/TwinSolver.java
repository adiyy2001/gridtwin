package dev.gridtwin.domain.twin;

import dev.gridtwin.domain.model.Branch;
import dev.gridtwin.domain.model.Bus;
import dev.gridtwin.domain.model.BusType;
import dev.gridtwin.domain.model.Generator;
import dev.gridtwin.domain.model.Load;
import dev.gridtwin.domain.model.Network;
import dev.gridtwin.domain.powerflow.BranchResult;
import dev.gridtwin.domain.powerflow.BusResult;
import dev.gridtwin.domain.powerflow.BusState;
import dev.gridtwin.domain.powerflow.EjmlSparseLuSolver;
import dev.gridtwin.domain.powerflow.GeneratorResult;
import dev.gridtwin.domain.powerflow.PowerFlow;
import dev.gridtwin.domain.powerflow.PowerFlowOptions;
import dev.gridtwin.domain.powerflow.PowerFlowResult;
import dev.gridtwin.domain.powerflow.ReactiveLimitState;
import dev.gridtwin.domain.powerflow.WarmStart;
import dev.gridtwin.domain.topology.Island;
import dev.gridtwin.domain.topology.Topology;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

public final class TwinSolver {

    private static final double REPRODUCIBLE_TOLERANCE = 1e-10;
    private static final int MAX_ITERATIONS = 20;

    private final PowerFlow powerFlow;

    public TwinSolver(PowerFlow powerFlow) {
        this.powerFlow = powerFlow;
    }

    public static TwinSolver standard() {
        return new TwinSolver(
                new PowerFlow(
                        new PowerFlowOptions(REPRODUCIBLE_TOLERANCE, MAX_ITERATIONS, true),
                        EjmlSparseLuSolver::new));
    }

    public TwinSolution solve(TwinState state) {
        return this.solve(state, Optional.empty());
    }

    public TwinSolution solve(TwinState state, WarmStart warmStart) {
        return this.solve(state, Optional.of(warmStart));
    }

    private TwinSolution solve(TwinState state, Optional<WarmStart> warmStart) {
        Topology topology = state.topology();
        List<IslandSolution> islands =
                topology.islands().stream()
                        .map(island -> this.solveIsland(topology.network(), island, warmStart))
                        .toList();
        Network network = topology.network();
        Map<String, BranchResult> branchResults = new HashMap<>();
        Map<String, GeneratorResult> generatorResults = new HashMap<>();
        Map<Integer, BusResult> busResults = new HashMap<>();
        islands.stream()
                .flatMap(island -> island.result().stream())
                .forEach(
                        result -> {
                            result.branches()
                                    .forEach(branch -> branchResults.put(branch.id(), branch));
                            result.generators()
                                    .forEach(
                                            generator ->
                                                    generatorResults.put(
                                                            generator.id(), generator));
                            result.buses().forEach(bus -> busResults.put(bus.number(), bus));
                        });
        List<BusResult> buses =
                network.buses().stream()
                        .map(
                                bus ->
                                        busResults.computeIfAbsent(
                                                bus.number(), number -> deadBus(network, bus)))
                        .toList();
        List<BranchResult> branches =
                network.branches().stream()
                        .map(
                                branch ->
                                        branchResults.computeIfAbsent(
                                                branch.id(), id -> deadBranch(branch)))
                        .toList();
        List<GeneratorResult> generators =
                network.generators().stream()
                        .map(
                                generator ->
                                        generatorResults.computeIfAbsent(
                                                generator.id(), id -> deadGenerator(generator)))
                        .toList();
        double totalLoad = network.totalLoadMw() + topology.disconnectedLoadMw();
        double served =
                islands.stream()
                        .filter(island -> island.state() == IslandState.ENERGIZED)
                        .flatMap(island -> island.result().stream())
                        .mapToDouble(PowerFlowResult::totalLoadMw)
                        .sum();
        double generation =
                islands.stream()
                        .flatMap(island -> island.result().stream())
                        .mapToDouble(PowerFlowResult::totalGenerationMw)
                        .sum();
        double losses =
                islands.stream()
                        .flatMap(island -> island.result().stream())
                        .mapToDouble(PowerFlowResult::totalLossMw)
                        .sum();
        return new TwinSolution(
                state,
                topology,
                islands,
                buses,
                branches,
                generators,
                totalLoad,
                totalLoad - served,
                generation,
                losses,
                warnings(topology, islands));
    }

    private IslandSolution solveIsland(
            Network whole, Island island, Optional<WarmStart> warmStart) {
        if (!island.energized()) {
            return new IslandSolution(
                    island, IslandState.DEENERGIZED, Optional.empty(), loadOf(whole, island));
        }
        Network network = island.network().orElseThrow();
        PowerFlowResult result =
                warmStart
                        .map(start -> this.powerFlow.solve(network, start))
                        .orElseGet(() -> this.powerFlow.solve(network));
        IslandState state = result.converged() ? IslandState.ENERGIZED : IslandState.COLLAPSED;
        double shed = result.converged() ? 0.0 : network.totalLoadMw();
        return new IslandSolution(island, state, Optional.of(result), shed);
    }

    private static double loadOf(Network whole, Island island) {
        return whole.loads().stream()
                .filter(load -> island.contains(load.bus()))
                .mapToDouble(Load::activePowerMw)
                .sum();
    }

    private static BusResult deadBus(Network network, Bus bus) {
        double active =
                network.loads().stream()
                        .filter(load -> load.bus() == bus.number())
                        .mapToDouble(Load::activePowerMw)
                        .sum();
        double reactive =
                network.loads().stream()
                        .filter(load -> load.bus() == bus.number())
                        .mapToDouble(Load::reactivePowerMvar)
                        .sum();
        return new BusResult(
                bus.number(),
                BusType.ISOLATED,
                BusState.DEENERGIZED,
                0.0,
                0.0,
                0.0,
                0.0,
                active,
                reactive);
    }

    private static BranchResult deadBranch(Branch branch) {
        return new BranchResult(
                branch.id(), branch.from(), branch.to(), false, 0, 0, 0, 0, 0, 0, 0, 0);
    }

    private static GeneratorResult deadGenerator(Generator generator) {
        return new GeneratorResult(
                generator.id(),
                generator.bus(),
                generator.inService(),
                0.0,
                0.0,
                ReactiveLimitState.NONE);
    }

    private static List<String> warnings(Topology topology, List<IslandSolution> islands) {
        List<String> warnings = new ArrayList<>();
        for (IslandSolution solution : islands) {
            solution.result()
                    .ifPresent(
                            result ->
                                    result.warnings()
                                            .forEach(
                                                    warning ->
                                                            warnings.add(
                                                                    "Island "
                                                                            + solution.island().id()
                                                                            + ": "
                                                                            + warning)));
            if (solution.state() == IslandState.DEENERGIZED && solution.shedLoadMw() > 0.0) {
                warnings.add(
                        String.format(
                                Locale.ROOT,
                                "Island %s has no generator that can take the slack role: %.1f MW of load is shed",
                                solution.island().id(),
                                solution.shedLoadMw()));
            }
        }
        if (topology.disconnectedLoadMw() > 0.0) {
            warnings.add(
                    String.format(
                            Locale.ROOT,
                            "%.1f MW of load is disconnected from the busbars",
                            topology.disconnectedLoadMw()));
        }
        return warnings;
    }
}
