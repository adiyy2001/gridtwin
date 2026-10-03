package dev.gridtwin.domain.application;

import java.security.SecureRandom;
import java.util.HexFormat;

public record SessionId(String value) {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int BYTES = 16;

    public SessionId {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("session id must not be blank");
        }
    }

    public static SessionId random() {
        byte[] bytes = new byte[BYTES];
        RANDOM.nextBytes(bytes);
        return new SessionId(HexFormat.of().formatHex(bytes));
    }

    @Override
    public String toString() {
        return this.value;
    }
}
