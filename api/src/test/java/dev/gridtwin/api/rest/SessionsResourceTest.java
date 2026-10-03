package dev.gridtwin.api.rest;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.offset;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.notNullValue;

import com.fasterxml.jackson.databind.JsonNode;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import java.util.Map;
import org.junit.jupiter.api.Test;

@QuarkusTest
class SessionsResourceTest {

    @Test
    void creatingASessionReturnsVersionOneWithTheSolvedState() {
        given().contentType(ContentType.JSON)
                .body(Map.of("caseId", "ieee14"))
                .post("/api/sessions")
                .then()
                .statusCode(201)
                .header("Location", matchesPattern(".*/api/sessions/[0-9a-f]{32}"))
                .body("sessionId", matchesPattern("[0-9a-f]{32}"))
                .body("createdAt", notNullValue())
                .body("state.version", equalTo(1))
                .body("state.state.caseId", equalTo("ieee14"))
                .body("state.state.converged", equalTo(true))
                .body("state.state.loadFactor", equalTo(1.0f))
                .body("state.state.buses", hasSize(14))
                .body("state.state.branches", hasSize(20))
                .body("state.state.generators", hasSize(5))
                .body("state.state.summary.overloadedBranches", equalTo(0));
    }

    @Test
    void aSessionWithoutABodyOrCaseUsesTheDefaultCase() {
        given().contentType(ContentType.JSON).post("/api/sessions").then().statusCode(201);
        given().contentType(ContentType.JSON)
                .body("{}")
                .post("/api/sessions")
                .then()
                .statusCode(201)
                .body("state.state.caseId", equalTo("ieee14"));
    }

    @Test
    void anUnknownOrNotSwitchableCaseIsRejected() {
        for (String caseId : new String[] {"nope", "ieee30"}) {
            given().contentType(ContentType.JSON)
                    .body(Map.of("caseId", caseId))
                    .post("/api/sessions")
                    .then()
                    .statusCode(404)
                    .body("code", equalTo("UNKNOWN_CASE"));
        }
    }

    @Test
    void theStateCanBeReadBackAndMatchesTheCreationState() {
        String id = Api.createSession();

        given().get("/api/sessions/{id}/state", id)
                .then()
                .statusCode(200)
                .body("version", equalTo(1))
                .body("state.switches.size()", equalTo(35))
                .body("state.nodes.size()", equalTo(22))
                .body("state.islands", hasSize(1));
    }

    @Test
    void openingTheCouplerOverloadsExactlyOneLine() {
        String id = Api.createSession();

        JsonNode result = Api.json(Api.operate(id, Api.COUPLER_BREAKER, "OPEN"));

        assertThat(result.get("version").asInt()).isEqualTo(2);
        JsonNode state = result.get("state");
        assertThat(state.get("converged").asBoolean()).isTrue();
        assertThat(state.get("summary").get("overloadedBranches").asInt()).isEqualTo(1);
        assertThat(state.get("branches"))
                .filteredOn(branch -> branch.get("overloaded").asBoolean())
                .singleElement()
                .satisfies(
                        branch -> {
                            assertThat(branch.get("id").asText()).isEqualTo("L2-4");
                            assertThat(branch.get("loading").asDouble()).isBetween(1.0, 1.3);
                        });
        assertThat(state.get("nodes"))
                .filteredOn(node -> node.get("id").asText().equals("CPL.A"))
                .singleElement()
                .satisfies(node -> assertThat(node.get("state").asText()).isNotEqualTo("EARTHED"));
    }

    @Test
    void closingTheCouplerAgainRestoresTheBaseFlows() {
        String id = Api.createSession();
        JsonNode before = Api.json(Api.state(id)).get("state").get("summary");
        Api.operate(id, Api.COUPLER_BREAKER, "OPEN").then().statusCode(200);

        JsonNode closed = Api.json(Api.operate(id, Api.COUPLER_BREAKER, "CLOSED"));

        assertThat(closed.get("version").asInt()).isEqualTo(3);
        assertThat(closed.get("state").get("summary").get("totalLossMw").asDouble())
                .isCloseTo(before.get("totalLossMw").asDouble(), offset(1e-8));
    }

    @Test
    void aRefusedOperationReturns409WithCodeReasonAndSwitchAndChangesNothing() {
        String id = Api.createSession();

        Api.operate(id, "L2-4.QB2", "OPEN")
                .then()
                .statusCode(409)
                .body("code", equalTo("BREAKER_CLOSED"))
                .body("switchId", equalTo("L2-4.QB2"))
                .body("message", containsString("L2-4.QA1"));

        Api.state(id).then().body("version", equalTo(1));
    }

    @Test
    void closingAnEarthingSwitchOnALiveSectionIsRefused() {
        String id = Api.createSession();

        Api.operate(id, "L2-4.QE1", "CLOSED")
                .then()
                .statusCode(409)
                .body("code", equalTo("SECTION_ENERGIZED"));
    }

    @Test
    void anUnknownSwitchIs404() {
        Api.operate(Api.createSession(), "NOPE", "OPEN")
                .then()
                .statusCode(404)
                .body("code", equalTo("UNKNOWN_SWITCH"))
                .body("switchId", equalTo("NOPE"));
    }

    @Test
    void operatingASwitchIntoItsCurrentPositionKeepsTheVersion() {
        String id = Api.createSession();

        Api.operate(id, Api.COUPLER_BREAKER, "CLOSED")
                .then()
                .statusCode(200)
                .body("version", equalTo(1));
    }

    @Test
    void theLoadFactorIsLimitedToHalfToOneAndAHalf() {
        String id = Api.createSession();

        Api.loadFactor(id, 0.49).then().statusCode(400).body("code", equalTo("INVALID_INPUT"));
        Api.loadFactor(id, 1.51).then().statusCode(400).body("message", containsString("0.5"));
        Api.loadFactor(id, 0.5).then().statusCode(200).body("version", equalTo(2));
        Api.loadFactor(id, 1.5)
                .then()
                .statusCode(200)
                .body("version", equalTo(3))
                .body("state.loadFactor", equalTo(1.5f));
        Api.state(id).then().body("version", equalTo(3));
    }

    @Test
    void aLoadFactorCallWithoutAValueIsInvalid() {
        given().contentType(ContentType.JSON)
                .body("{}")
                .put("/api/sessions/{id}/load-factor", Api.createSession())
                .then()
                .statusCode(400)
                .body("code", equalTo("INVALID_INPUT"));
    }

    @Test
    void unknownSessionsAre404ForEveryCall() {
        String missing = "00000000000000000000000000000000";

        Api.state(missing).then().statusCode(404).body("code", equalTo("UNKNOWN_SESSION"));
        Api.operate(missing, Api.COUPLER_BREAKER, "OPEN").then().statusCode(404);
        Api.loadFactor(missing, 1.0).then().statusCode(404);
        given().delete("/api/sessions/{id}", missing).then().statusCode(404);
    }

    @Test
    void closingASessionRemovesIt() {
        String id = Api.createSession();

        given().delete("/api/sessions/{id}", id).then().statusCode(204);

        Api.state(id).then().statusCode(404);
    }

    @Test
    void malformedBodiesAreBadRequestsWithTheSharedErrorShape() {
        String id = Api.createSession();
        String path = "/api/sessions/{id}/switches/" + Api.COUPLER_BREAKER;

        given().contentType(ContentType.JSON)
                .body("{bad")
                .post(path, id)
                .then()
                .statusCode(400)
                .body("code", equalTo("HTTP_400"));
        given().contentType(ContentType.JSON)
                .body("{\"position\":\"AJAR\"}")
                .post(path, id)
                .then()
                .statusCode(400)
                .body("code", equalTo("INVALID_INPUT"))
                .body("message", containsString("position"));
        given().contentType(ContentType.JSON)
                .body("{}")
                .post(path, id)
                .then()
                .statusCode(400)
                .body("message", containsString("position"));
        given().contentType(ContentType.JSON)
                .post(path, id)
                .then()
                .statusCode(400)
                .body("code", equalTo("INVALID_INPUT"));
        given().contentType(ContentType.TEXT)
                .body("x")
                .post(path, id)
                .then()
                .statusCode(415)
                .body("code", equalTo("HTTP_415"));
    }

    @Test
    void unknownRoutesUseTheSameErrorShape() {
        given().get("/api/nothing").then().statusCode(404).body("code", equalTo("HTTP_404"));
    }

    @Test
    void oversizedBodiesAreRejected() {
        given().contentType(ContentType.JSON)
                .body("{\"caseId\":\"" + "x".repeat(70_000) + "\"}")
                .post("/api/sessions")
                .then()
                .statusCode(413);
    }
}
