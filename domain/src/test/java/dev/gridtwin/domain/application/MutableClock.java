package dev.gridtwin.domain.application;

import java.time.Duration;
import java.time.ZonedDateTime;

final class MutableClock implements TimeSource {

    private volatile ZonedDateTime now =
            ZonedDateTime.parse("2026-10-03T08:00:00+02:00[Europe/Warsaw]");

    void advance(Duration duration) {
        this.now = this.now.plus(duration);
    }

    @Override
    public ZonedDateTime now() {
        return this.now;
    }
}
