package dev.gridtwin.validation.solver;

import static org.assertj.core.api.Assertions.assertThat;

import dev.gridtwin.cases.CaseLoader;
import dev.gridtwin.domain.model.Branch;
import dev.gridtwin.domain.model.Bus;
import dev.gridtwin.domain.model.BusType;
import dev.gridtwin.domain.model.Network;
import dev.gridtwin.domain.model.Shunt;
import dev.gridtwin.domain.powerflow.BusIndex;
import dev.gridtwin.domain.powerflow.CompressedColumnMatrix;
import dev.gridtwin.domain.powerflow.Injections;
import dev.gridtwin.domain.powerflow.Jacobian;
import dev.gridtwin.domain.powerflow.Ybus;
import java.util.List;
import java.util.Random;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class JacobianFiniteDifferenceTest {

    private static final double STEP = 1e-6;
    private static final double RELATIVE_TOLERANCE = 1e-6;

    private record Layout(Ybus ybus, int[] angleBuses, int[] magnitudeBuses) {}

    private static Layout layoutOf(Network network) {
        BusIndex index = BusIndex.of(network.buses().stream().map(Bus::number).toList());
        Ybus ybus = Ybus.build(network, index);
        int[] angleBuses =
                IntStream.range(0, index.size())
                        .filter(
                                position ->
                                        network.buses().get(position).type() != BusType.REFERENCE)
                        .toArray();
        int[] magnitudeBuses =
                IntStream.range(0, index.size())
                        .filter(position -> network.buses().get(position).type() == BusType.PQ)
                        .toArray();
        return new Layout(ybus, angleBuses, magnitudeBuses);
    }

    private static double[] mismatchFunction(Layout layout, double[] magnitudes, double[] angles) {
        Injections injections = layout.ybus().injections(magnitudes, angles);
        double[] values = new double[layout.angleBuses().length + layout.magnitudeBuses().length];
        for (int row = 0; row < layout.angleBuses().length; row++) {
            values[row] = injections.activePower()[layout.angleBuses()[row]];
        }
        for (int row = 0; row < layout.magnitudeBuses().length; row++) {
            values[layout.angleBuses().length + row] =
                    injections.reactivePower()[layout.magnitudeBuses()[row]];
        }
        return values;
    }

    private static double[][] centralDifferences(
            Layout layout, double[] magnitudes, double[] angles) {
        int unknowns = layout.angleBuses().length + layout.magnitudeBuses().length;
        double[][] numeric = new double[unknowns][unknowns];
        for (int column = 0; column < unknowns; column++) {
            double[] upMagnitudes = magnitudes.clone();
            double[] upAngles = angles.clone();
            double[] downMagnitudes = magnitudes.clone();
            double[] downAngles = angles.clone();
            if (column < layout.angleBuses().length) {
                upAngles[layout.angleBuses()[column]] += STEP;
                downAngles[layout.angleBuses()[column]] -= STEP;
            } else {
                int bus = layout.magnitudeBuses()[column - layout.angleBuses().length];
                upMagnitudes[bus] += STEP;
                downMagnitudes[bus] -= STEP;
            }
            double[] up = mismatchFunction(layout, upMagnitudes, upAngles);
            double[] down = mismatchFunction(layout, downMagnitudes, downAngles);
            for (int row = 0; row < unknowns; row++) {
                numeric[row][column] = (up[row] - down[row]) / (2.0 * STEP);
            }
        }
        return numeric;
    }

    private static void assertMatchesFiniteDifferences(Network network, long seed) {
        Layout layout = layoutOf(network);
        Random random = new Random(seed);
        int size = layout.ybus().size();
        double[] magnitudes = new double[size];
        double[] angles = new double[size];
        for (int bus = 0; bus < size; bus++) {
            magnitudes[bus] = 0.95 + 0.1 * random.nextDouble();
            angles[bus] = 0.2 * (random.nextDouble() - 0.5);
        }

        CompressedColumnMatrix analytic =
                Jacobian.assemble(
                        layout.ybus(),
                        magnitudes,
                        angles,
                        layout.angleBuses(),
                        layout.magnitudeBuses());
        double[][] numeric = centralDifferences(layout, magnitudes, angles);

        assertThat(analytic.rowCount()).isEqualTo(numeric.length);
        for (int row = 0; row < numeric.length; row++) {
            for (int column = 0; column < numeric.length; column++) {
                double expected = numeric[row][column];
                double actual = analytic.get(row, column);
                assertThat(Math.abs(actual - expected))
                        .as("entry (%d,%d)", row, column)
                        .isLessThanOrEqualTo(
                                RELATIVE_TOLERANCE * Math.max(1.0, Math.abs(expected)));
            }
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"ieee14", "ieee30"})
    void theAnalyticJacobianOfTheTestSystemsMatchesCentralDifferences(String caseId) {
        assertMatchesFiniteDifferences(CaseLoader.load(caseId).network(), 11L);
    }

    @Test
    void theAnalyticJacobianOfAThreeBusNetworkWithATapAndAShiftMatchesCentralDifferences() {
        List<Bus> buses =
                List.of(
                        new Bus(1, BusType.REFERENCE, 132.0, 0.9, 1.1, 1.0, 0.0),
                        new Bus(2, BusType.PQ, 132.0, 0.9, 1.1, 1.0, 0.0),
                        new Bus(3, BusType.PQ, 132.0, 0.9, 1.1, 1.0, 0.0));
        Network network =
                new Network(
                        "three",
                        100.0,
                        buses,
                        List.of(),
                        List.of(new Shunt(3, 2.0, 10.0)),
                        List.of(),
                        List.of(
                                new Branch("A", 1, 2, 0.01, 0.2, 0.04, 100.0, 1.0, 0.0, true),
                                new Branch("B", 2, 3, 0.0, 0.25, 0.0, 100.0, 0.95, 12.0, true),
                                new Branch("C", 1, 3, 0.1, 0.3, 0.02, 100.0, 1.0, 0.0, true)));

        assertMatchesFiniteDifferences(network, 5L);
    }
}
