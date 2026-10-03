package dev.gridtwin.domain.powerflow;

public record BranchResult(
        String id,
        int from,
        int to,
        boolean energized,
        double activeFromMw,
        double reactiveFromMvar,
        double activeToMw,
        double reactiveToMvar,
        double currentFromKa,
        double currentToKa,
        double loading,
        double lossMw) {

    public double apparentFromMva() {
        return Math.hypot(this.activeFromMw, this.reactiveFromMvar);
    }

    public double apparentToMva() {
        return Math.hypot(this.activeToMw, this.reactiveToMvar);
    }

    public double apparentPowerMva() {
        return Math.max(this.apparentFromMva(), this.apparentToMva());
    }

    public boolean overloaded() {
        return this.loading > 1.0;
    }
}
