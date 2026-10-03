package dev.gridtwin.api.config;

import dev.gridtwin.domain.application.ModelCatalog;
import dev.gridtwin.domain.application.SessionLimits;
import dev.gridtwin.domain.application.SessionRepository;
import dev.gridtwin.domain.application.SessionService;
import dev.gridtwin.domain.application.StatePublisher;
import dev.gridtwin.domain.application.TimeSource;
import jakarta.enterprise.inject.Disposes;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Singleton;
import java.time.Duration;
import java.util.concurrent.ForkJoinPool;
import org.eclipse.microprofile.config.inject.ConfigProperty;

public class ApplicationBeans {

    @Produces
    @Singleton
    TimeSource timeSource() {
        return TimeSource.system();
    }

    @Produces
    @Singleton
    SessionLimits sessionLimits(
            @ConfigProperty(name = "gridtwin.sessions.max") int maxSessions,
            @ConfigProperty(name = "gridtwin.sessions.idle-minutes") long idleMinutes) {
        return new SessionLimits(maxSessions, Duration.ofMinutes(idleMinutes));
    }

    @Produces
    @Singleton
    ForkJoinPool contingencyPool() {
        return new ForkJoinPool(Runtime.getRuntime().availableProcessors());
    }

    void closeContingencyPool(@Disposes ForkJoinPool pool) {
        pool.shutdown();
    }

    @Produces
    @Singleton
    SessionService sessionService(
            TimeSource time,
            SessionRepository sessions,
            StatePublisher publisher,
            ModelCatalog catalog,
            ForkJoinPool pool,
            SessionLimits limits) {
        return new SessionService(time, sessions, publisher, catalog, pool, limits);
    }
}
