package dev.gridtwin.api.adapter;

import dev.gridtwin.domain.application.SessionId;
import dev.gridtwin.domain.application.SessionRepository;
import dev.gridtwin.domain.application.TwinSession;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@ApplicationScoped
public class InMemorySessionRepository implements SessionRepository {

    private final Map<SessionId, TwinSession> sessions = new ConcurrentHashMap<>();

    @Override
    public void save(TwinSession session) {
        this.sessions.put(session.id(), session);
    }

    @Override
    public Optional<TwinSession> find(SessionId id) {
        return Optional.ofNullable(this.sessions.get(id));
    }

    @Override
    public boolean remove(SessionId id) {
        return this.sessions.remove(id) != null;
    }

    @Override
    public int count() {
        return this.sessions.size();
    }

    @Override
    public List<TwinSession> all() {
        return List.copyOf(this.sessions.values());
    }
}
