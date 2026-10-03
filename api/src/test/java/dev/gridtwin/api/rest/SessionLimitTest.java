package dev.gridtwin.api.rest;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import io.restassured.http.ContentType;
import java.util.Map;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestProfile(SessionLimitTest.TwoSessions.class)
class SessionLimitTest {

    public static class TwoSessions implements QuarkusTestProfile {

        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of("gridtwin.sessions.max", "2");
        }
    }

    @Test
    void theThirdSessionIsRefusedWith429AndARetryHintUntilOneIsClosed() {
        String first = Api.createSession();
        Api.createSession();

        given().contentType(ContentType.JSON)
                .post("/api/sessions")
                .then()
                .statusCode(429)
                .header("Retry-After", "60")
                .body("code", equalTo("SESSION_LIMIT_REACHED"));

        given().delete("/api/sessions/{id}", first).then().statusCode(204);
        given().contentType(ContentType.JSON).post("/api/sessions").then().statusCode(201);
    }
}
