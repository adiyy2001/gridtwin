package dev.gridtwin.domain.application;

import java.util.List;
import java.util.Optional;

public interface SessionRepository {

    void save(TwinSession session);

    Optional<TwinSession> find(SessionId id);

    boolean remove(SessionId id);

    int count();

    List<TwinSession> all();
}
