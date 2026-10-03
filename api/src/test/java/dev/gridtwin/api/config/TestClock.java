package dev.gridtwin.api.config;

import dev.gridtwin.domain.application.TimeSource;
import jakarta.annotation.Priority;
import jakarta.enterprise.inject.Alternative;
import jakarta.inject.Singleton;
import java.time.Duration;
import java.time.ZonedDateTime;

@Alternative
@Priority(1)
@Singleton
public class TestClock implements TimeSource {

    private volatile Duration shift = Duration.ZERO;

    public void advance(Duration duration) {
        this.shift = this.shift.plus(duration);
    }

    public void reset() {
        this.shift = Duration.ZERO;
    }

    @Override
    public ZonedDateTime now() {
        return ZonedDateTime.now().plus(this.shift);
    }
}
