package dev.gridtwin.domain.powerflow;

import dev.gridtwin.domain.model.BusType;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Optional;

final class StartingPoint {

    private StartingPoint() {}

    static double[] magnitudes(
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

    static double[] angles(
            IslandModel model, PowerFlowProblem problem, Optional<WarmStart> warmStart) {
        double referenceAngle =
                Math.toRadians(
                        model.network()
                                .findBus(model.index().numberAt(problem.referenceBus()))
                                .orElseThrow()
                                .voltageAngleDegrees());
        double[] angles = new double[problem.roles().length];
        boolean[] known = new boolean[angles.length];
        for (int position = 0; position < angles.length; position++) {
            int number = model.index().numberAt(position);
            Optional<Double> previous =
                    warmStart.map(start -> start.anglesDegrees().get(number)).map(Math::toRadians);
            boolean isReference = problem.roles()[position] == BusType.REFERENCE;
            known[position] = isReference || previous.isPresent();
            angles[position] = isReference ? referenceAngle : previous.orElse(referenceAngle);
        }
        if (warmStart.isPresent()) {
            spreadToUnknownNeighbours(model.ybus(), angles, known);
        }
        return angles;
    }

    private static void spreadToUnknownNeighbours(Ybus ybus, double[] angles, boolean[] known) {
        Deque<Integer> queue = new ArrayDeque<>();
        for (int position = 0; position < known.length; position++) {
            if (known[position]) {
                queue.add(position);
            }
        }
        while (!queue.isEmpty()) {
            int current = queue.poll();
            for (int entry = ybus.rowStart(current); entry < ybus.rowEnd(current); entry++) {
                int neighbour = ybus.column(entry);
                if (!known[neighbour]) {
                    known[neighbour] = true;
                    angles[neighbour] = angles[current];
                    queue.add(neighbour);
                }
            }
        }
    }
}
