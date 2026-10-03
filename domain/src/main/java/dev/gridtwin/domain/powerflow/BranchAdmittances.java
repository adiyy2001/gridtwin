package dev.gridtwin.domain.powerflow;

import dev.gridtwin.domain.model.Branch;

public record BranchAdmittances(
        Admittance fromFrom, Admittance fromTo, Admittance toFrom, Admittance toTo) {

    public static BranchAdmittances of(Branch branch) {
        double denominator =
                branch.resistance() * branch.resistance() + branch.reactance() * branch.reactance();
        Admittance series =
                new Admittance(
                        branch.resistance() / denominator, -branch.reactance() / denominator);
        Admittance halfCharging = new Admittance(0.0, branch.chargingSusceptance() / 2.0);
        Admittance seriesWithCharging = series.plus(halfCharging);
        double shiftRadians = Math.toRadians(branch.shiftDegrees());
        return new BranchAdmittances(
                seriesWithCharging.scaled(1.0 / (branch.tap() * branch.tap())),
                series.negated().rotated(shiftRadians).scaled(1.0 / branch.tap()),
                series.negated().rotated(-shiftRadians).scaled(1.0 / branch.tap()),
                seriesWithCharging);
    }
}
