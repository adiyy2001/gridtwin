package dev.gridtwin.api.websocket;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.equalTo;

import dev.gridtwin.api.rest.Api;
import io.quarkus.test.common.http.TestHTTPResource;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.RestAssured;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

@QuarkusTest
class StateSocketTest {

    @TestHTTPResource("/")
    URL baseUrl;

    private TestSocket connect(String sessionId) {
        return TestSocket.connect(this.baseUrl.toString(), sessionId);
    }

    @Test
    void connectingPushesTheCurrentVersionedState() {
        String id = Api.createSession();

        try (TestSocket socket = this.connect(id)) {
            socket.awaitMessages(1);

            assertThat(socket.versions()).containsExactly(1L);
            assertThat(socket.messages().get(0).get("state").get("converged").asBoolean()).isTrue();
            assertThat(socket.messages().get(0).get("state").get("buses")).hasSize(14);
        }
    }

    @Test
    void aRestCommandPushesAHigherVersionToTheConnectedClient() {
        String id = Api.createSession();
        try (TestSocket socket = this.connect(id)) {
            socket.awaitMessages(1);

            Api.operate(id, Api.COUPLER_BREAKER, "OPEN").then().statusCode(200);
            socket.awaitMessages(2);

            assertThat(socket.versions()).containsExactly(1L, 2L);
            assertThat(
                            socket.messages()
                                    .get(1)
                                    .get("state")
                                    .get("summary")
                                    .get("overloadedBranches")
                                    .asInt())
                    .isEqualTo(1);
        }
    }

    @Test
    void aLateClientStartsAtTheCurrentVersion() {
        String id = Api.createSession();
        Api.loadFactor(id, 1.1).then().statusCode(200);
        Api.loadFactor(id, 1.2).then().statusCode(200);

        try (TestSocket socket = this.connect(id)) {
            socket.awaitMessages(1);

            assertThat(socket.versions()).containsExactly(3L);
        }
    }

    @Test
    void sessionsAreIsolated() throws Exception {
        String first = Api.createSession();
        String second = Api.createSession();
        try (TestSocket firstSocket = this.connect(first);
                TestSocket secondSocket = this.connect(second)) {
            firstSocket.awaitMessages(1);
            secondSocket.awaitMessages(1);

            Api.operate(first, Api.COUPLER_BREAKER, "OPEN").then().statusCode(200);
            firstSocket.awaitMessages(2);
            secondSocket.stayQuietFor(500);

            assertThat(firstSocket.versions()).containsExactly(1L, 2L);
            assertThat(secondSocket.versions()).containsExactly(1L);
            Api.state(second).then().body("version", equalTo(1));
        }
    }

    @Test
    void aRefusedCommandPushesNothing() throws Exception {
        String id = Api.createSession();
        try (TestSocket socket = this.connect(id)) {
            socket.awaitMessages(1);

            Api.operate(id, "L2-4.QB2", "OPEN").then().statusCode(409);
            Api.operate(id, Api.COUPLER_BREAKER, "CLOSED").then().statusCode(200);
            socket.stayQuietFor(500);

            assertThat(socket.versions()).containsExactly(1L);
        }
    }

    @Test
    void severalClientsOnOneSessionAllReceiveEveryVersion() {
        String id = Api.createSession();
        try (TestSocket first = this.connect(id);
                TestSocket second = this.connect(id)) {
            first.awaitMessages(1);
            second.awaitMessages(1);

            Api.loadFactor(id, 0.9).then().statusCode(200);
            first.awaitMessages(2);
            second.awaitMessages(2);

            assertThat(first.versions()).isEqualTo(second.versions()).containsExactly(1L, 2L);
        }
    }

    @Test
    void parallelCommandsOnOneSessionProduceStrictlyIncreasingVersions() throws Exception {
        String id = Api.createSession();
        int commands = 20;
        try (TestSocket socket = this.connect(id);
                ExecutorService executor = Executors.newFixedThreadPool(8)) {
            socket.awaitMessages(1);

            List<Future<Long>> results =
                    IntStream.range(0, commands)
                            .<Future<Long>>mapToObj(
                                    index ->
                                            executor.submit(
                                                    () ->
                                                            Api.loadFactor(id, 0.6 + index * 0.02)
                                                                    .then()
                                                                    .statusCode(200)
                                                                    .extract()
                                                                    .jsonPath()
                                                                    .getLong("version")))
                            .toList();
            List<Long> returned = new ArrayList<>();
            for (Future<Long> result : results) {
                returned.add(result.get());
            }
            socket.awaitMessages(commands + 1);

            assertThat(returned).doesNotHaveDuplicates();
            assertThat(returned)
                    .containsExactlyInAnyOrderElementsOf(
                            IntStream.rangeClosed(2, commands + 1)
                                    .mapToObj(Long::valueOf)
                                    .toList());
            List<Long> pushed = socket.versions();
            assertThat(pushed).hasSize(commands + 1).isSorted().doesNotHaveDuplicates();
            assertThat(pushed.get(commands)).isEqualTo(commands + 1L);
        }
    }

    @Test
    void anUnknownSessionIsClosedWithAPolicyViolation() {
        try (TestSocket socket = this.connect("00000000000000000000000000000000")) {
            assertThat(socket.awaitClose()).hasValue(1008);
            assertThat(socket.messages()).isEmpty();
        }
    }

    @Test
    void closingTheSessionClosesItsSockets() {
        String id = Api.createSession();
        try (TestSocket socket = this.connect(id)) {
            socket.awaitMessages(1);

            RestAssured.given().delete("/api/sessions/{id}", id).then().statusCode(204);

            assertThat(socket.awaitClose()).hasValue(1000);
        }
    }
}
