package dev.gridtwin.bench;

public record Target(
        String name, String measurement, double limitMs, double actualP95Ms, boolean met) {

    public static Target p95Below(String name, Measurement measurement, double limitMs) {
        double actual = measurement.statistics().p95Ms();
        return new Target(name, measurement.name(), limitMs, actual, actual < limitMs);
    }
}
