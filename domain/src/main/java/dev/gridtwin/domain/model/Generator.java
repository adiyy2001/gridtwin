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
}
