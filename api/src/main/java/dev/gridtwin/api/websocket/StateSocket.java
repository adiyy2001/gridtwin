package dev.gridtwin.api.websocket;

import dev.gridtwin.api.dto.VersionedStateDto;
import dev.gridtwin.domain.application.SessionId;
import dev.gridtwin.domain.application.SessionService;
import dev.gridtwin.domain.application.TwinException;
import io.quarkus.websockets.next.CloseReason;
import io.quarkus.websockets.next.OnOpen;
import io.quarkus.websockets.next.WebSocket;
import io.quarkus.websockets.next.WebSocketConnection;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;

@WebSocket(path = "/ws/sessions/{sessionId}")
public class StateSocket {

    static final String SESSION_PARAMETER = "sessionId";
    static final int UNKNOWN_SESSION_CLOSE_CODE = 1008;

    private final SessionService sessions;
    private final StateMessages messages;

    @Inject
    public StateSocket(SessionService sessions, StateMessages messages) {
        this.sessions = sessions;
        this.messages = messages;
    }

    @OnOpen
    public Uni<Void> sendCurrentState(WebSocketConnection connection) {
        SessionId id = new SessionId(connection.pathParam(SESSION_PARAMETER));
        try {
            return connection.sendText(
                    this.messages.write(VersionedStateDto.from(this.sessions.state(id))));
        } catch (TwinException exception) {
            return connection.close(
                    new CloseReason(UNKNOWN_SESSION_CLOSE_CODE, exception.failure().code()));
        }
    }
}
