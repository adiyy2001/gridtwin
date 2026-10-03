package dev.gridtwin.domain.powerflow;

import java.util.Optional;
import org.ejml.data.DMatrixRMaj;
import org.ejml.data.DMatrixSparseCSC;
import org.ejml.interfaces.linsol.LinearSolverSparse;
import org.ejml.sparse.FillReducing;
import org.ejml.sparse.csc.factory.LinearSolverFactory_DSCC;

public final class EjmlSparseLuSolver implements SparseLinearSolver {

    private final LinearSolverSparse<DMatrixSparseCSC, DMatrixRMaj> solver =
            LinearSolverFactory_DSCC.lu(FillReducing.NONE);

    @Override
    public Optional<double[]> solve(CompressedColumnMatrix matrix, double[] rightHandSide) {
        if (matrix.rowCount() != matrix.columnCount()
                || matrix.rowCount() != rightHandSide.length) {
            throw new IllegalArgumentException("matrix and right hand side sizes do not match");
        }
        if (!this.solver.setA(toEjml(matrix))) {
            return Optional.empty();
        }
        DMatrixRMaj solution = new DMatrixRMaj(rightHandSide.length, 1);
        this.solver.solve(
                DMatrixRMaj.wrap(rightHandSide.length, 1, rightHandSide.clone()), solution);
        return Optional.of(solution.getData());
    }

    private static DMatrixSparseCSC toEjml(CompressedColumnMatrix matrix) {
        DMatrixSparseCSC converted =
                new DMatrixSparseCSC(
                        matrix.rowCount(), matrix.columnCount(), matrix.nonZeroCount());
        int[] columnStarts = matrix.columnStarts();
        int[] rowIndices = matrix.rowIndices();
        double[] values = matrix.values();
        System.arraycopy(columnStarts, 0, converted.col_idx, 0, columnStarts.length);
        System.arraycopy(rowIndices, 0, converted.nz_rows, 0, rowIndices.length);
        System.arraycopy(values, 0, converted.nz_values, 0, values.length);
        converted.nz_length = values.length;
        converted.indicesSorted = true;
        return converted;
    }
}
