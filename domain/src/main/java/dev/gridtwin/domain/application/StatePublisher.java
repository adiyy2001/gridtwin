package dev.gridtwin.domain.application;

public interface StatePublisher {

    void publish(SessionId id, Versioned state);

    void sessionClosed(SessionId id);
}
