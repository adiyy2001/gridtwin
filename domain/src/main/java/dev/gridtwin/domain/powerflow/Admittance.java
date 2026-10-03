package dev.gridtwin.domain.powerflow;

public record Admittance(double conductance, double susceptance) {

    public static final Admittance ZERO = new Admittance(0.0, 0.0);

    public Admittance plus(Admittance other) {
        return new Admittance(
                this.conductance + other.conductance, this.susceptance + other.susceptance);
    }

    public Admittance negated() {
        return new Admittance(-this.conductance, -this.susceptance);
    }

    public Admittance scaled(double factor) {
        return new Admittance(this.conductance * factor, this.susceptance * factor);
    }

    public Admittance rotated(double angleRadians) {
        double cosine = Math.cos(angleRadians);
        double sine = Math.sin(angleRadians);
        return new Admittance(
                this.conductance * cosine - this.susceptance * sine,
                this.conductance * sine + this.susceptance * cosine);
    }

    public double magnitude() {
        return Math.hypot(this.conductance, this.susceptance);
    }
}
