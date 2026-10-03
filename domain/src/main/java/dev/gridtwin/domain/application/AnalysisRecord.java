package dev.gridtwin.domain.application;

import dev.gridtwin.domain.twin.TwinState;

public record AnalysisRecord<T>(long version, TwinState state, T result) {}
