package dev.gridtwin.validation.property;

public final class Discard extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public Discard(String reason) {
        super(reason, null, false, false);
    }

    public static void unless(boolean condition, String reason) {
        if (!condition) {
            throw new Discard(reason);
        }
    }
}
