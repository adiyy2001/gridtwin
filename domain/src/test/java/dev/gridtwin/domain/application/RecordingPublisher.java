package dev.gridtwin.domain.application;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

final class RecordingPublisher implements StatePublisher {

    private final List<Versioned> published = Collections.synchronizedList(new ArrayList<>());
    private final List<SessionId> closed = Collections.synchronizedList(new ArrayList<>());

    @Override
    public void publish(SessionId id, Versioned state) {
        this.published.add(state);
    }

    @Override
    public void sessionClosed(SessionId id) {
        this.closed.add(id);
    }

    List<Long> versions() {
        synchronized (this.published) {
            return this.published.stream().map(Versioned::version).toList();
        }
    }

    List<SessionId> closed() {
        return List.copyOf(this.closed);
    }
}
