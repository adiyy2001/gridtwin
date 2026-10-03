package dev.gridtwin.domain.model;

public record Bus(
        int number,
        BusType type,
        double baseKv,
        double voltageMin,
        double voltageMax,
        double voltageMagnitude,
        double voltageAngleDegrees) {

    public Bus {
        if (number <= 0) {
            throw new IllegalArgumentException("bus number must be positive: " + number);
        }
        if (baseKv <= 0) {
            throw new IllegalArgumentException("base voltage must be positive for bus " + number);
        }
        if (voltageMin > voltageMax) {
            throw new IllegalArgumentException("voltage band is inverted for bus " + number);
        }
    }
}
