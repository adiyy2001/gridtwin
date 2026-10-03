package dev.gridtwin.cases;

public class CaseLoadException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public CaseLoadException(String message) {
        super(message);
    }

    public CaseLoadException(String message, Throwable cause) {
        super(message, cause);
    }
}
