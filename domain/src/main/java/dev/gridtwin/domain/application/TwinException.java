package dev.gridtwin.domain.application;

public final class TwinException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    private final transient TwinFailure failure;

    public TwinException(TwinFailure failure) {
        super(failure.message());
        this.failure = failure;
    }

    public TwinFailure failure() {
        return this.failure;
    }
}
