package dev.gridtwin.domain.powerflow;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

final class NewtonRaphson {

    private final SparseLinearSolver linearSolver;
    private final double tolerance;
    private final int maxIterations;

    NewtonRaphson(SparseLinearSolver linearSolver, double tolerance, int maxIterations) {
        this.linearSolver = linearSolver;
        this.tolerance = tolerance;
        this.maxIterations = maxIterations;
    }

    NewtonOutcome solve(PowerFlowProblem problem, double[] startMagnitudes, double[] startAngles) {
        double[] magnitudes = startMagnitudes.clone();
        double[] angles = startAngles.clone();
        int[] angleBuses = problem.angleBuses();
        int[] magnitudeBuses = problem.magnitudeBuses();
        List<Double> history = new ArrayList<>();
        for (int iteration = 0; ; iteration++) {
            double[] mismatch = mismatch(problem, magnitudes, angles, angleBuses, magnitudeBuses);
            double norm = maxAbsolute(mismatch);
            if (!Double.isFinite(norm)) {
                return failed(
                        CollapseReason.INVALID_VOLTAGE, iteration, history, magnitudes, angles);
            }
            history.add(norm);
            if (norm <= this.tolerance) {
                return new NewtonOutcome(Optional.empty(), iteration, history, magnitudes, angles);
            }
            if (iteration == this.maxIterations) {
                return failed(
                        CollapseReason.ITERATION_LIMIT, iteration, history, magnitudes, angles);
            }
            CompressedColumnMatrix jacobian =
                    Jacobian.assemble(
                            problem.ybus(), magnitudes, angles, angleBuses, magnitudeBuses);
            Optional<double[]> step = this.linearSolver.solve(jacobian, mismatch);
            if (step.isEmpty()) {
                return failed(
                        CollapseReason.SINGULAR_JACOBIAN, iteration, history, magnitudes, angles);
            }
            apply(step.get(), angleBuses, magnitudeBuses, magnitudes, angles);
            if (!valid(magnitudes, angles)) {
                return failed(
                        CollapseReason.INVALID_VOLTAGE, iteration + 1, history, magnitudes, angles);
            }
        }
    }

    private static NewtonOutcome failed(
            CollapseReason reason,
            int iterations,
            List<Double> history,
            double[] magnitudes,
            double[] angles) {
        return new NewtonOutcome(Optional.of(reason), iterations, history, magnitudes, angles);
    }

    private static double[] mismatch(
            PowerFlowProblem problem,
            double[] magnitudes,
            double[] angles,
            int[] angleBuses,
            int[] magnitudeBuses) {
        Injections injections = problem.ybus().injections(magnitudes, angles);
        double[] mismatch = new double[angleBuses.length + magnitudeBuses.length];
        for (int row = 0; row < angleBuses.length; row++) {
            int bus = angleBuses[row];
            mismatch[row] = problem.activeSpecified()[bus] - injections.activePower()[bus];
        }
        for (int row = 0; row < magnitudeBuses.length; row++) {
            int bus = magnitudeBuses[row];
            mismatch[angleBuses.length + row] =
                    problem.reactiveSpecified()[bus] - injections.reactivePower()[bus];
        }
        return mismatch;
    }

    private static void apply(
            double[] step,
            int[] angleBuses,
            int[] magnitudeBuses,
            double[] magnitudes,
            double[] angles) {
        for (int row = 0; row < angleBuses.length; row++) {
            angles[angleBuses[row]] += step[row];
        }
        for (int row = 0; row < magnitudeBuses.length; row++) {
            magnitudes[magnitudeBuses[row]] += step[angleBuses.length + row];
        }
    }

    private static boolean valid(double[] magnitudes, double[] angles) {
        for (int bus = 0; bus < magnitudes.length; bus++) {
            if (!Double.isFinite(magnitudes[bus])
                    || !Double.isFinite(angles[bus])
                    || magnitudes[bus] <= 0.0) {
                return false;
            }
        }
        return true;
    }

    private static double maxAbsolute(double[] values) {
        double largest = 0.0;
        for (double value : values) {
            if (Double.isNaN(value)) {
                return Double.NaN;
            }
            largest = Math.max(largest, Math.abs(value));
        }
        return largest;
    }
}
