package dev.gridtwin.api.websocket;

import dev.gridtwin.api.dto.VersionedStateDto;
import dev.gridtwin.domain.application.SessionId;
import dev.gridtwin.domain.application.StatePublisher;
import dev.gridtwin.domain.application.Versioned;
import io.quarkus.websockets.next.CloseReason;
import io.quarkus.websockets.next.OpenConnections;
import io.quarkus.websockets.next.WebSocketConnection;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.List;
import org.jboss.logging.Logger;

@ApplicationScoped
public class WebSocketStatePublisher implements StatePublisher {

    private static final Logger LOG = Logger.getLogger(WebSocketStatePublisher.class);
    private static final int NORMAL_CLOSE_CODE = 1000;

    private final OpenConnections connections;
    private final StateMessages messages;

    @Inject
    public WebSocketStatePublisher(OpenConnections connections, StateMessages messages) {
        this.connections = connections;
        this.messages = messages;
    }

    @Override
    public void publish(SessionId id, Versioned state) {
        List<WebSocketConnection> targets = this.connectionsOf(id);
        if (targets.isEmpty()) {
            return;
        }
        String message = this.messages.write(VersionedStateDto.from(state));
        targets.forEach(
                connection ->
                        connection
                                .sendText(message)
                                .subscribe()
                                .with(
                                        ignored -> {},
                                        failure ->
                                                LOG.debugf(
                                                        "state not delivered to %s: %s",
                                                        connection.id(), failure.getMessage())));
    }

    @Override
    public void sessionClosed(SessionId id) {
        this.connectionsOf(id)
                .forEach(
                        connection ->
                                connection
                                        .close(new CloseReason(NORMAL_CLOSE_CODE, "session closed"))
                                        .subscribe()
                                        .with(ignored -> {}, failure -> {}));
    }

    private List<WebSocketConnection> connectionsOf(SessionId id) {
        return this.connections.stream()
                .filter(
                        connection ->
                                id.value()
                                        .equals(
                                                connection.pathParam(
                                                        StateSocket.SESSION_PARAMETER)))
                .toList();
    }
}
