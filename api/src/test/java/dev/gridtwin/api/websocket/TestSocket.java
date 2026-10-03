package dev.gridtwin.api.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.OptionalInt;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.awaitility.Awaitility;

final class TestSocket implements WebSocket.Listener, AutoCloseable {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final List<JsonNode> messages = Collections.synchronizedList(new ArrayList<>());
    private final StringBuilder partial = new StringBuilder();
    private final AtomicInteger closeCode = new AtomicInteger(-1);
    private WebSocket socket;

    static TestSocket connect(String baseUrl, String sessionId) {
        TestSocket listener = new TestSocket();
        URI uri = URI.create(baseUrl.replaceFirst("^http", "ws") + "ws/sessions/" + sessionId);
        listener.socket =
                HttpClient.newHttpClient().newWebSocketBuilder().buildAsync(uri, listener).join();
        return listener;
    }

    @Override
    public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
        this.partial.append(data);
        if (last) {
            try {
                this.messages.add(MAPPER.readTree(this.partial.toString()));
            } catch (Exception exception) {
                throw new IllegalStateException(exception);
            } finally {
                this.partial.setLength(0);
            }
        }
        webSocket.request(1);
        return null;
    }

    @Override
    public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {
        this.closeCode.set(statusCode);
        return null;
    }

    List<JsonNode> messages() {
        synchronized (this.messages) {
            return List.copyOf(this.messages);
        }
    }

    List<Long> versions() {
        return this.messages().stream().map(message -> message.get("version").asLong()).toList();
    }

    void awaitMessages(int count) {
        Awaitility.await()
                .atMost(Duration.ofSeconds(10))
                .until(() -> this.messages().size() >= count);
    }

    OptionalInt awaitClose() {
        Awaitility.await().atMost(Duration.ofSeconds(10)).until(() -> this.closeCode.get() >= 0);
        return OptionalInt.of(this.closeCode.get());
    }

    void stayQuietFor(long milliseconds) throws InterruptedException {
        TimeUnit.MILLISECONDS.sleep(milliseconds);
    }

    @Override
    public void close() {
        if (!this.socket.isOutputClosed()) {
            this.socket.sendClose(WebSocket.NORMAL_CLOSURE, "done").join();
        }
    }
}
