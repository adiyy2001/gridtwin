package dev.gridtwin.domain.application;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

final class InMemorySessions implements SessionRepository {

    private final Map<SessionId, TwinSession> byId = new ConcurrentHashMap<>();

    @Override
    public void save(TwinSession session) {
        this.byId.put(session.id(), session);
    }

    @Override
    public Optional<TwinSession> find(SessionId id) {
        return Optional.ofNullable(this.byId.get(id));
    }

    @Override
    public boolean remove(SessionId id) {
        return this.byId.remove(id) != null;
    }

    @Override
    public int count() {
        return this.byId.size();
    }

    @Override
    public List<TwinSession> all() {
        return List.copyOf(this.byId.values());
    }
}
