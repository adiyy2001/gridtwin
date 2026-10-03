package dev.gridtwin.domain.model;

public record Load(int bus, double activePowerMw, double reactivePowerMvar) {

    public Load scaled(double factor) {
        return new Load(this.bus, this.activePowerMw * factor, this.reactivePowerMvar * factor);
    }

    public Load atBus(int busNumber) {
        return new Load(busNumber, this.activePowerMw, this.reactivePowerMvar);
    }
}
