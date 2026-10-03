package dev.gridtwin.domain.powerflow;

import dev.gridtwin.domain.model.Branch;
import dev.gridtwin.domain.model.Network;
import dev.gridtwin.domain.model.Shunt;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

public final class Ybus {

    private final BusIndex index;
    private final int[] rowStarts;
    private final int[] columns;
    private final double[] conductances;
    private final double[] susceptances;

    private Ybus(
            BusIndex index,
            int[] rowStarts,
            int[] columns,
            double[] conductances,
            double[] susceptances) {
        this.index = index;
        this.rowStarts = rowStarts;
        this.columns = columns;
        this.conductances = conductances;
        this.susceptances = susceptances;
    }

    public static Ybus build(Network network, BusIndex index) {
        List<Map<Integer, Admittance>> rows = new ArrayList<>();
        for (int position = 0; position < index.size(); position++) {
            Map<Integer, Admittance> row = new TreeMap<>();
            row.put(position, Admittance.ZERO);
            rows.add(row);
        }
        network.shunts().stream()
                .filter(shunt -> index.contains(shunt.bus()))
                .forEach(
                        shunt ->
                                add(
                                        rows,
                                        index.requirePosition(shunt.bus()),
                                        index.requirePosition(shunt.bus()),
                                        shuntAdmittance(shunt, network.baseMva())));
        network.branches().stream()
                .filter(Branch::inService)
                .filter(branch -> index.contains(branch.from()) && index.contains(branch.to()))
                .forEach(branch -> addBranch(rows, index, branch));
        return compress(index, rows);
    }

    public int size() {
        return this.index.size();
    }

    public int nonZeroCount() {
        return this.columns.length;
    }

    public Admittance at(int row, int column) {
        for (int entry = this.rowStarts[row]; entry < this.rowStarts[row + 1]; entry++) {
            if (this.columns[entry] == column) {
                return new Admittance(this.conductances[entry], this.susceptances[entry]);
            }
        }
        return Admittance.ZERO;
    }

    public Injections injections(double[] magnitudes, double[] anglesRadians) {
        double[] active = new double[this.size()];
        double[] reactive = new double[this.size()];
        for (int row = 0; row < this.size(); row++) {
            double sumActive = 0.0;
            double sumReactive = 0.0;
            for (int entry = this.rowStarts[row]; entry < this.rowStarts[row + 1]; entry++) {
                int column = this.columns[entry];
                double angle = anglesRadians[row] - anglesRadians[column];
                double cosine = Math.cos(angle);
                double sine = Math.sin(angle);
                double coupling = magnitudes[column];
                sumActive +=
                        coupling
                                * (this.conductances[entry] * cosine
                                        + this.susceptances[entry] * sine);
                sumReactive +=
                        coupling
                                * (this.conductances[entry] * sine
                                        - this.susceptances[entry] * cosine);
            }
            active[row] = magnitudes[row] * sumActive;
            reactive[row] = magnitudes[row] * sumReactive;
        }
        return new Injections(active, reactive);
    }

    int rowStart(int row) {
        return this.rowStarts[row];
    }

    int rowEnd(int row) {
        return this.rowStarts[row + 1];
    }

    int column(int entry) {
        return this.columns[entry];
    }

    double conductance(int entry) {
        return this.conductances[entry];
    }

    double susceptance(int entry) {
        return this.susceptances[entry];
    }

    private static Admittance shuntAdmittance(Shunt shunt, double baseMva) {
        return new Admittance(shunt.conductanceMw() / baseMva, shunt.susceptanceMvar() / baseMva);
    }

    private static void addBranch(
            List<Map<Integer, Admittance>> rows, BusIndex index, Branch branch) {
        int from = index.requirePosition(branch.from());
        int to = index.requirePosition(branch.to());
        BranchAdmittances admittances = BranchAdmittances.of(branch);
        add(rows, from, from, admittances.fromFrom());
        add(rows, from, to, admittances.fromTo());
        add(rows, to, from, admittances.toFrom());
        add(rows, to, to, admittances.toTo());
    }

    private static void add(
            List<Map<Integer, Admittance>> rows, int row, int column, Admittance value) {
        rows.get(row).merge(column, value, Admittance::plus);
    }

    private static Ybus compress(BusIndex index, List<Map<Integer, Admittance>> rows) {
        int count = rows.stream().mapToInt(Map::size).sum();
        int[] rowStarts = new int[rows.size() + 1];
        int[] columns = new int[count];
        double[] conductances = new double[count];
        double[] susceptances = new double[count];
        int entry = 0;
        for (int row = 0; row < rows.size(); row++) {
            rowStarts[row] = entry;
            for (Map.Entry<Integer, Admittance> cell : rows.get(row).entrySet()) {
                columns[entry] = cell.getKey();
                conductances[entry] = cell.getValue().conductance();
                susceptances[entry] = cell.getValue().susceptance();
                entry++;
            }
        }
        rowStarts[rows.size()] = entry;
        return new Ybus(index, rowStarts, columns, conductances, susceptances);
    }
}
