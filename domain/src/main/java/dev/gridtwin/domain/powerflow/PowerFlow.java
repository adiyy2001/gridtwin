package dev.gridtwin.domain.powerflow;

import dev.gridtwin.domain.model.Network;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;

public final class PowerFlow {

    private static final double PHYSICAL_VOLTAGE_FLOOR = 0.5;

    private final PowerFlowOptions options;
    private final Supplier<SparseLinearSolver> solverFactory;

    public PowerFlow(PowerFlowOptions options, Supplier<SparseLinearSolver> solverFactory) {
        this.options = options;
        this.solverFactory = solverFactory;
    }

    public static PowerFlow standard() {
        return new PowerFlow(PowerFlowOptions.standard(), EjmlSparseLuSolver::new);
    }

    public PowerFlowOptions options() {
        return this.options;
    }

    public PowerFlowResult solve(Network network) {
        return this.run(network, Optional.empty());
    }

    public PowerFlowResult solve(Network network, WarmStart warmStart) {
        PowerFlowResult warm = this.run(network, Optional.of(warmStart));
        if (warm.converged() && lowestVoltage(warm) >= PHYSICAL_VOLTAGE_FLOOR) {
            return warm;
        }
        PowerFlowResult flat = this.run(network, Optional.empty());
        return flat.converged() ? flat : warm;
    }

    private PowerFlowResult run(Network network, Optional<WarmStart> warmStart) {
        List<Integer> energized = Connectivity.reachableFromReference(network);
        if (energized.isEmpty()) {
            return ResultAssembler.withoutIsland(network);
        }
        IslandModel model = new IslandModel(network, BusIndex.of(energized));
        ResultAssembler assembler = new ResultAssembler(model);
        NewtonRaphson newton =
                new NewtonRaphson(
                        this.solverFactory.get(),
                        this.options.tolerance(),
                        this.options.maxIterations());
        Map<Integer, ReactiveLimitState> converted = new LinkedHashMap<>();
        PowerFlowProblem problem = model.problem(converted);
        double[] magnitudes = StartingPoint.magnitudes(model, problem, warmStart);
        double[] angles = StartingPoint.angles(model, problem, warmStart);
        int totalIterations = 0;
        int rounds = 0;
        while (true) {
            NewtonOutcome outcome = newton.solve(problem, magnitudes, angles);
            totalIterations += outcome.iterations();
            if (!outcome.converged()) {
                return assembler.collapsed(converted, outcome, totalIterations);
            }
            Map<Integer, ReactiveLimitState> violations =
                    this.options.enforceReactiveLimits()
                            ? ReactiveLimits.newViolations(model, problem, outcome)
                            : Map.of();
            if (violations.isEmpty()) {
                return assembler.converged(problem, outcome, converted, totalIterations, rounds);
            }
            converted.putAll(violations);
            rounds++;
            problem = model.problem(converted);
            magnitudes = outcome.magnitudes();
            angles = outcome.anglesRadians();
        }
    }

    private static double lowestVoltage(PowerFlowResult result) {
        return result.buses().stream()
                .filter(BusResult::energized)
                .mapToDouble(BusResult::voltageMagnitude)
                .min()
                .orElse(1.0);
    }
}
