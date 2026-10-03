package dev.gridtwin.domain.powerflow;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public final class Jacobian {

    private Jacobian() {}

    public static CompressedColumnMatrix assemble(
            Ybus ybus,
            double[] magnitudes,
            double[] anglesRadians,
            int[] angleBuses,
            int[] magnitudeBuses) {
        int unknowns = angleBuses.length + magnitudeBuses.length;
        int[] angleColumns = positions(ybus.size(), angleBuses, 0);
        int[] magnitudeColumns = positions(ybus.size(), magnitudeBuses, angleBuses.length);
        Injections injections = ybus.injections(magnitudes, anglesRadians);
        EntryList entries = new EntryList();
        for (int rowOffset = 0; rowOffset < angleBuses.length; rowOffset++) {
            int bus = angleBuses[rowOffset];
            addRow(
                    entries,
                    ybus,
                    bus,
                    rowOffset,
                    true,
                    magnitudes,
                    anglesRadians,
                    injections,
                    angleColumns,
                    magnitudeColumns);
        }
        for (int rowOffset = 0; rowOffset < magnitudeBuses.length; rowOffset++) {
            int bus = magnitudeBuses[rowOffset];
            addRow(
                    entries,
                    ybus,
                    bus,
                    angleBuses.length + rowOffset,
                    false,
                    magnitudes,
                    anglesRadians,
                    injections,
                    angleColumns,
                    magnitudeColumns);
        }
        return entries.toMatrix(unknowns);
    }

    private static int[] positions(int size, int[] buses, int offset) {
        int[] positions = new int[size];
        Arrays.fill(positions, -1);
        for (int position = 0; position < buses.length; position++) {
            positions[buses[position]] = offset + position;
        }
        return positions;
    }

    private static void addRow(
            EntryList entries,
            Ybus ybus,
            int bus,
            int row,
            boolean activeRow,
            double[] magnitudes,
            double[] angles,
            Injections injections,
            int[] angleColumns,
            int[] magnitudeColumns) {
        double voltage = magnitudes[bus];
        for (int entry = ybus.rowStart(bus); entry < ybus.rowEnd(bus); entry++) {
            int other = ybus.column(entry);
            double conductance = ybus.conductance(entry);
            double susceptance = ybus.susceptance(entry);
            double angle = angles[bus] - angles[other];
            double cosine = Math.cos(angle);
            double sine = Math.sin(angle);
            double angleDerivative;
            double magnitudeDerivative;
            if (other == bus) {
                double active = injections.activePower()[bus];
                double reactive = injections.reactivePower()[bus];
                angleDerivative =
                        activeRow
                                ? -reactive - susceptance * voltage * voltage
                                : active - conductance * voltage * voltage;
                magnitudeDerivative =
                        activeRow
                                ? active / voltage + conductance * voltage
                                : reactive / voltage - susceptance * voltage;
            } else {
                double sineTerm = conductance * sine - susceptance * cosine;
                double cosineTerm = conductance * cosine + susceptance * sine;
                angleDerivative =
                        activeRow
                                ? voltage * magnitudes[other] * sineTerm
                                : -voltage * magnitudes[other] * cosineTerm;
                magnitudeDerivative = activeRow ? voltage * cosineTerm : voltage * sineTerm;
            }
            if (angleColumns[other] >= 0) {
                entries.add(row, angleColumns[other], angleDerivative);
            }
            if (magnitudeColumns[other] >= 0) {
                entries.add(row, magnitudeColumns[other], magnitudeDerivative);
            }
        }
    }

    private static final class EntryList {

        private final List<int[]> positions = new ArrayList<>();
        private final List<Double> values = new ArrayList<>();

        void add(int row, int column, double value) {
            this.positions.add(new int[] {row, column});
            this.values.add(value);
        }

        CompressedColumnMatrix toMatrix(int size) {
            int[] rows = this.positions.stream().mapToInt(position -> position[0]).toArray();
            int[] columns = this.positions.stream().mapToInt(position -> position[1]).toArray();
            double[] entryValues = this.values.stream().mapToDouble(Double::doubleValue).toArray();
            return CompressedColumnMatrix.fromEntries(size, size, rows, columns, entryValues);
        }
    }
}
