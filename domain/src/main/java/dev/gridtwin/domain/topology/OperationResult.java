package dev.gridtwin.domain.topology;

public sealed interface OperationResult {

    record Accepted(String switchId, Position position, boolean changed)
            implements OperationResult {}

    record Refused(Refusal refusal) implements OperationResult {}

    default boolean accepted() {
        return this instanceof Accepted;
    }
}
