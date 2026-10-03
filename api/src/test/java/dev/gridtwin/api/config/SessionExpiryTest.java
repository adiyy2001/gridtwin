package dev.gridtwin.api.config;

import static org.assertj.core.api.Assertions.assertThat;

import dev.gridtwin.api.rest.Api;
import dev.gridtwin.domain.application.SessionService;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.time.Duration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class SessionExpiryTest {

    @Inject TestClock clock;

    @Inject SessionService sessions;

    @Inject SessionJanitor janitor;

    @AfterEach
    void restoreTime() {
        this.clock.reset();
    }

    @Test
    void anIdleSessionIsDroppedByTheJanitorAndAnActiveOneStays() {
        String idle = Api.createSession();
        String active = Api.createSession();
        this.clock.advance(Duration.ofMinutes(20));
        Api.state(active).then().statusCode(200);
        this.clock.advance(Duration.ofMinutes(15));

        this.janitor.evictIdleSessions();

        Api.state(idle).then().statusCode(404);
        Api.state(active).then().statusCode(200);
        assertThat(this.sessions.limits().idleTimeToLive()).isEqualTo(Duration.ofMinutes(30));
    }
}
