package dev.gridtwin.bench;

public record Measurement(String name, String description, int warmupRuns, Statistics statistics) {}
