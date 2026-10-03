package dev.gridtwin.domain.application;

import java.time.Duration;

public record SessionLimits(int maxSessions, Duration idleTimeToLive) {

    public SessionLimits {
        if (maxSessions < 1) {
            throw new IllegalArgumentException("the session cap must be at least 1");
        }
        if (idleTimeToLive.isNegative() || idleTimeToLive.isZero()) {
            throw new IllegalArgumentException("the idle time to live must be positive");
        }
    }

    public static SessionLimits standard() {
        return new SessionLimits(200, Duration.ofMinutes(30));
    }
}
