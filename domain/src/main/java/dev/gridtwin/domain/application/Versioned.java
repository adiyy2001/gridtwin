package dev.gridtwin.domain.application;

import dev.gridtwin.domain.twin.TwinSolution;

public record Versioned(long version, TwinSolution solution) {}
