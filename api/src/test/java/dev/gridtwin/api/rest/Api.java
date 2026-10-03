package dev.gridtwin.api.rest;

import static io.restassured.RestAssured.given;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.restassured.http.ContentType;
import io.restassured.response.Response;
import java.util.Map;

public final class Api {

    public static final String COUPLER_BREAKER = "CPL.QA1";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private Api() {}

    public static JsonNode json(Response response) {
        try {
            return MAPPER.readTree(response.asString());
        } catch (Exception exception) {
            throw new IllegalStateException(response.asString(), exception);
        }
    }

    public static String createSession() {
        return given().contentType(ContentType.JSON)
                .post("/api/sessions")
                .then()
                .statusCode(201)
                .extract()
                .path("sessionId");
    }

    public static Response operate(String sessionId, String switchId, String position) {
        return given().contentType(ContentType.JSON)
                .body(Map.of("position", position))
                .post("/api/sessions/{id}/switches/{switchId}", sessionId, switchId);
    }

    public static Response loadFactor(String sessionId, double factor) {
        return given().contentType(ContentType.JSON)
                .body(Map.of("loadFactor", factor))
                .put("/api/sessions/{id}/load-factor", sessionId);
    }

    public static Response state(String sessionId) {
        return given().get("/api/sessions/{id}/state", sessionId);
    }

    public static Response runContingencies(String sessionId) {
        return given().post("/api/sessions/{id}/analyses/n-1", sessionId);
    }

    public static Response cascade(String sessionId, Map<String, Object> body) {
        return given().contentType(ContentType.JSON)
                .body(body)
                .post("/api/sessions/{id}/analyses/cascade", sessionId);
    }
}
