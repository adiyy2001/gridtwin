package dev.gridtwin.domain.powerflow;

import java.util.Arrays;
import java.util.stream.IntStream;

public final class CompressedColumnMatrix {

    private final int rowCount;
    private final int columnCount;
    private final int[] columnStarts;
    private final int[] rowIndices;
    private final double[] values;

    private CompressedColumnMatrix(
            int rowCount, int columnCount, int[] columnStarts, int[] rowIndices, double[] values) {
        this.rowCount = rowCount;
        this.columnCount = columnCount;
        this.columnStarts = columnStarts;
        this.rowIndices = rowIndices;
        this.values = values;
    }

    public static CompressedColumnMatrix fromEntries(
            int rowCount, int columnCount, int[] rows, int[] columns, double[] entryValues) {
        int[] columnStarts = new int[columnCount + 1];
        for (int column : columns) {
            columnStarts[column + 1]++;
        }
        for (int column = 0; column < columnCount; column++) {
            columnStarts[column + 1] += columnStarts[column];
        }
        Integer[] order = IntStream.range(0, rows.length).boxed().toArray(Integer[]::new);
        Arrays.sort(
                order,
                (left, right) ->
                        columns[left] != columns[right]
                                ? Integer.compare(columns[left], columns[right])
                                : Integer.compare(rows[left], rows[right]));
        int[] rowIndices = new int[rows.length];
        double[] values = new double[rows.length];
        for (int position = 0; position < order.length; position++) {
            rowIndices[position] = rows[order[position]];
            values[position] = entryValues[order[position]];
        }
        return new CompressedColumnMatrix(rowCount, columnCount, columnStarts, rowIndices, values);
    }

    public int rowCount() {
        return this.rowCount;
    }

    public int columnCount() {
        return this.columnCount;
    }

    public int nonZeroCount() {
        return this.values.length;
    }

    public int[] columnStarts() {
        return this.columnStarts.clone();
    }

    public int[] rowIndices() {
        return this.rowIndices.clone();
    }

    public double[] values() {
        return this.values.clone();
    }

    public double get(int row, int column) {
        for (int entry = this.columnStarts[column];
                entry < this.columnStarts[column + 1];
                entry++) {
            if (this.rowIndices[entry] == row) {
                return this.values[entry];
            }
        }
        return 0.0;
    }
}
