package dev.gridtwin.domain.powerflow;

public record GeneratorResult(
        String id,
        int bus,
        boolean inService,
        double activeMw,
        double reactiveMvar,
        ReactiveLimitState reactiveLimit) {}
