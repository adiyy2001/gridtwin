package dev.gridtwin.api.config;

import dev.gridtwin.domain.application.SessionService;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

@ApplicationScoped
public class SessionJanitor {

    private static final Logger LOG = Logger.getLogger(SessionJanitor.class);

    private final SessionService sessions;

    @Inject
    public SessionJanitor(SessionService sessions) {
        this.sessions = sessions;
    }

    @Scheduled(every = "1m", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void evictIdleSessions() {
        int evicted = this.sessions.evictIdle();
        if (evicted > 0) {
            LOG.infof("evicted %d idle sessions", evicted);
        }
    }
}
