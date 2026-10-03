package dev.gridtwin.api.dto;

final class Numbers {

    private Numbers() {}

    static double finite(double value) {
        return Double.isFinite(value) ? value : 0.0;
    }
}
