package dev.gridtwin.domain.model;

public record Generator(
        String id,
        int bus,
        double activePowerMw,
        double reactivePowerMvar,
        double reactiveMinMvar,
        double reactiveMaxMvar,
        double activeMinMw,
        double activeMaxMw,
        double voltageSetpoint,
        boolean inService) {

    public Generator {
        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException("generator id must not be blank");
        }
        if (reactiveMinMvar > reactiveMaxMvar) {
            throw new IllegalArgumentException("reactive range is inverted for generator " + id);
        }
        if (activeMinMw > activeMaxMw) {
            throw new IllegalArgumentException("active range is inverted for generator " + id);
        }
    }

    public Generator withInService(boolean service) {
        return new Generator(
                this.id,
                this.bus,
                this.activePowerMw,
                this.reactivePowerMvar,
                this.reactiveMinMvar,
                this.reactiveMaxMvar,
                this.activeMinMw,
                this.activeMaxMw,
                this.voltageSetpoint,
                service);
    }

    public Generator atBus(int busNumber) {
        return new Generator(
                this.id,
                busNumber,
                this.activePowerMw,
                this.reactivePowerMvar,
                this.reactiveMinMvar,
                this.reactiveMaxMvar,
                this.activeMinMw,
                this.activeMaxMw,
                this.voltageSetpoint,
                this.inService);
    }

    public boolean canTakeSlack() {
        return this.inService && this.activeMaxMw > 0.0;
    }
}
