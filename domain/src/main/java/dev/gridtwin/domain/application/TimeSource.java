package dev.gridtwin.domain.application;

import java.time.ZonedDateTime;

public interface TimeSource {

    ZonedDateTime now();

    static TimeSource system() {
        return ZonedDateTime::now;
    }
}
