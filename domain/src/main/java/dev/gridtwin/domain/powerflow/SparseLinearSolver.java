package dev.gridtwin.domain.powerflow;

import java.util.Optional;

public interface SparseLinearSolver {

    Optional<double[]> solve(CompressedColumnMatrix matrix, double[] rightHandSide);
}
