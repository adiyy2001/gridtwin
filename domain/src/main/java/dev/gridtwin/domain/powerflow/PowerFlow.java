package dev.gridtwin.domain.powerflow;

import dev.gridtwin.domain.model.BusType;
import dev.gridtwin.domain.model.Network;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;

public final class PowerFlow {

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
        return this.run(network, Optional.of(warmStart));
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
        double[] magnitudes = this.startMagnitudes(model, problem, warmStart);
        double[] angles = this.startAngles(model, problem, warmStart);
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

    private double[] startMagnitudes(
            IslandModel model, PowerFlowProblem problem, Optional<WarmStart> warmStart) {
        double[] magnitudes = new double[problem.roles().length];
        for (int position = 0; position < magnitudes.length; position++) {
            int number = model.index().numberAt(position);
            magnitudes[position] =
                    problem.roles()[position] == BusType.PQ
                            ? warmStart.map(start -> start.magnitudes().get(number)).orElse(1.0)
                            : model.setpoint(position);
        }
        return magnitudes;
    }

    private double[] startAngles(
            IslandModel model, PowerFlowProblem problem, Optional<WarmStart> warmStart) {
        double referenceAngle =
                Math.toRadians(
                        model.network()
                                .findBus(model.index().numberAt(problem.referenceBus()))
                                .orElseThrow()
                                .voltageAngleDegrees());
        double[] angles = new double[problem.roles().length];
        for (int position = 0; position < angles.length; position++) {
            int number = model.index().numberAt(position);
            angles[position] =
                    problem.roles()[position] == BusType.REFERENCE
                            ? referenceAngle
                            : warmStart
                                    .map(start -> start.anglesDegrees().get(number))
                                    .map(Math::toRadians)
                                    .orElse(referenceAngle);
        }
        return angles;
    }
}
