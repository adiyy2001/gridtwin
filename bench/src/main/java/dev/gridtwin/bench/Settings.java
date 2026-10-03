package dev.gridtwin.bench;

public record Settings(int warmupRuns, int measuredRuns) {

    public Settings {
        if (warmupRuns < 0 || measuredRuns < 1) {
            throw new IllegalArgumentException("settings are out of range");
        }
    }

    public static Settings standard() {
        return new Settings(300, 300);
    }

    public static Settings quick() {
        return new Settings(2, 3);
    }
}
