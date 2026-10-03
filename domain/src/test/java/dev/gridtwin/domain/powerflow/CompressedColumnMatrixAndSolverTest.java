package dev.gridtwin.domain.powerflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

import java.util.Optional;
import org.junit.jupiter.api.Test;

class CompressedColumnMatrixAndSolverTest {

    private static CompressedColumnMatrix threeByThree() {
        return CompressedColumnMatrix.fromEntries(
                3,
                3,
                new int[] {2, 0, 1, 2, 0, 2},
                new int[] {0, 0, 1, 1, 2, 2},
                new double[] {1.0, 4.0, 3.0, 1.0, 2.0, 5.0});
    }

    @Test
    void entriesAreSortedByColumnAndThenByRow() {
        CompressedColumnMatrix matrix = threeByThree();

        assertThat(matrix.columnStarts()).containsExactly(0, 2, 4, 6);
        assertThat(matrix.rowIndices()).containsExactly(0, 2, 1, 2, 0, 2);
        assertThat(matrix.rowCount()).isEqualTo(3);
        assertThat(matrix.columnCount()).isEqualTo(3);
        assertThat(matrix.nonZeroCount()).isEqualTo(6);
        assertThat(matrix.values()).containsExactly(4.0, 1.0, 3.0, 1.0, 2.0, 5.0);
    }

    @Test
    void getReturnsStoredEntriesAndZeroElsewhere() {
        CompressedColumnMatrix matrix = threeByThree();

        assertThat(matrix.get(0, 0)).isEqualTo(4.0);
        assertThat(matrix.get(2, 2)).isEqualTo(5.0);
        assertThat(matrix.get(0, 1)).isZero();
    }

    @Test
    void theEjmlSolverSolvesASparseSystem() {
        CompressedColumnMatrix matrix =
                CompressedColumnMatrix.fromEntries(
                        3,
                        3,
                        new int[] {0, 1, 2, 0, 2},
                        new int[] {0, 1, 2, 2, 0},
                        new double[] {4.0, 3.0, 2.0, 1.0, 1.0});
        double[] expected = {1.0, -2.0, 3.0};
        double[] rightHandSide = {4.0 * 1.0 + 1.0 * 3.0, 3.0 * -2.0, 1.0 * 1.0 + 2.0 * 3.0};

        Optional<double[]> solution = new EjmlSparseLuSolver().solve(matrix, rightHandSide);

        assertThat(solution).isPresent();
        assertThat(solution.get()).containsExactly(expected, within(1e-12));
    }

    @Test
    void theSolverDoesNotModifyTheRightHandSide() {
        CompressedColumnMatrix identity =
                CompressedColumnMatrix.fromEntries(
                        2, 2, new int[] {0, 1}, new int[] {0, 1}, new double[] {2.0, 2.0});
        double[] rightHandSide = {2.0, 4.0};

        new EjmlSparseLuSolver().solve(identity, rightHandSide);

        assertThat(rightHandSide).containsExactly(2.0, 4.0);
    }

    @Test
    void aSingularMatrixGivesNoSolution() {
        CompressedColumnMatrix singular =
                CompressedColumnMatrix.fromEntries(
                        2,
                        2,
                        new int[] {0, 0, 1, 1},
                        new int[] {0, 1, 0, 1},
                        new double[] {1.0, 2.0, 2.0, 4.0});

        assertThat(new EjmlSparseLuSolver().solve(singular, new double[] {1.0, 1.0})).isEmpty();
    }

    @Test
    void aMatrixWithoutAnyEntryGivesNoSolution() {
        CompressedColumnMatrix empty =
                CompressedColumnMatrix.fromEntries(2, 2, new int[0], new int[0], new double[0]);

        assertThat(new EjmlSparseLuSolver().solve(empty, new double[] {1.0, 1.0})).isEmpty();
    }

    @Test
    void sizesThatDoNotMatchAreRejected() {
        EjmlSparseLuSolver solver = new EjmlSparseLuSolver();

        assertThatThrownBy(() -> solver.solve(threeByThree(), new double[] {1.0, 2.0}))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void oneSolverInstanceCanBeReusedForSeveralMatrices() {
        EjmlSparseLuSolver solver = new EjmlSparseLuSolver();
        CompressedColumnMatrix two =
                CompressedColumnMatrix.fromEntries(
                        1, 1, new int[] {0}, new int[] {0}, new double[] {2.0});
        CompressedColumnMatrix five =
                CompressedColumnMatrix.fromEntries(
                        1, 1, new int[] {0}, new int[] {0}, new double[] {5.0});

        assertThat(solver.solve(two, new double[] {4.0}).orElseThrow()[0]).isEqualTo(2.0);
        assertThat(solver.solve(five, new double[] {4.0}).orElseThrow()[0]).isEqualTo(0.8);
    }
}
