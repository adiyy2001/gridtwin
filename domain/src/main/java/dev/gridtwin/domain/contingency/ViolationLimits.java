package dev.gridtwin.domain.contingency;

public record ViolationLimits(double maxLoading, double minVoltage, double maxVoltage) {

    public ViolationLimits {
        if (!(maxLoading > 0 && minVoltage > 0 && minVoltage < maxVoltage)) {
            throw new IllegalArgumentException("violation limits are out of range");
        }
    }

    public static ViolationLimits standard() {
        return new ViolationLimits(1.0, 0.9, 1.1);
    }

    public double halfBand() {
        return (this.maxVoltage - this.minVoltage) / 2.0;
    }
}
