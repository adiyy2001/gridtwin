package dev.gridtwin.api.rest;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;

import com.fasterxml.jackson.databind.JsonNode;
import io.quarkus.test.junit.QuarkusTest;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AnalysesResourceTest {

    private static List<JsonNode> list(JsonNode array) {
        return StreamSupport.stream(array.spliterator(), false).toList();
    }

    private static List<String> trippedIds(JsonNode cascade) {
        return list(cascade.get("steps")).stream()
                .filter(step -> step.has("tripped"))
                .map(step -> step.get("tripped").get("id").asText())
                .toList();
    }

    @Test
    void theContingencyRunRanksEveryBranchAndGeneratorWorstFirst() {
        String id = Api.createSession();

        JsonNode report = Api.json(Api.runContingencies(id));

        List<JsonNode> ranked = list(report.get("contingencies"));
        assertThat(ranked).hasSize(25);
        assertThat(ranked.stream().map(entry -> entry.get("rank").asInt()))
                .containsExactlyElementsOf(IntStream.rangeClosed(1, 25).boxed().toList());
        assertThat(ranked.get(0).get("severity").get("tier").asText()).isEqualTo("NON_CONVERGED");
        assertThat(ranked.stream().map(entry -> entry.get("id").asText()))
                .contains("branch:L1-2", "generator:G1", "branch:T4-7");
        JsonNode tiers = report.get("tiers");
        assertThat(
                        tiers.get("secure").asInt()
                                + tiers.get("degraded").asInt()
                                + tiers.get("blackout").asInt()
                                + tiers.get("nonConverged").asInt())
                .isEqualTo(25);
        assertThat(report.get("stateVersion").asInt()).isEqualTo(1);
        assertThat(report.get("baseViolations")).isEmpty();
    }

    @Test
    void theContingencyRunReflectsTheCurrentSwitchState() {
        String id = Api.createSession();
        Api.operate(id, Api.COUPLER_BREAKER, "OPEN").then().statusCode(200);

        JsonNode report = Api.json(Api.runContingencies(id));

        assertThat(report.get("stateVersion").asInt()).isEqualTo(2);
        assertThat(list(report.get("baseViolations")))
                .singleElement()
                .satisfies(
                        violation -> {
                            assertThat(violation.get("kind").asText()).isEqualTo("BRANCH_OVERLOAD");
                            assertThat(violation.get("subject").asText()).isEqualTo("L2-4");
                        });
    }

    @Test
    void aKeptResultCanBeReadAndOneContingencyPreviewedWithoutANewSolve() {
        String id = Api.createSession();
        Api.runContingencies(id).then().statusCode(200);

        given().get("/api/sessions/{id}/analyses/n-1", id)
                .then()
                .statusCode(200)
                .body("contingencies", hasSize(25));
        JsonNode preview =
                Api.json(given().get("/api/sessions/{id}/analyses/n-1/{c}", id, "branch:L6-12"));

        assertThat(preview.get("contingency").get("id").asText()).isEqualTo("branch:L6-12");
        assertThat(preview.get("contingency").get("outage").get("kind").asText())
                .isEqualTo("BRANCH");
        assertThat(list(preview.get("state").get("branches")))
                .filteredOn(branch -> branch.get("id").asText().equals("L6-12"))
                .singleElement()
                .satisfies(
                        branch -> {
                            assertThat(branch.get("inService").asBoolean()).isFalse();
                            assertThat(branch.get("energized").asBoolean()).isFalse();
                        });
    }

    @Test
    void aGeneratorContingencyIsMarkedAsAGeneratorOutage() {
        String id = Api.createSession();
        Api.runContingencies(id).then().statusCode(200);

        given().get("/api/sessions/{id}/analyses/n-1/{c}", id, "generator:G2")
                .then()
                .statusCode(200)
                .body("contingency.outage.kind", equalTo("GENERATOR"))
                .body("contingency.outage.equipmentId", equalTo("G2"));
    }

    @Test
    void previewNeedsARunForTheCurrentStateAndAKnownContingency() {
        String id = Api.createSession();

        given().get("/api/sessions/{id}/analyses/n-1", id)
                .then()
                .statusCode(404)
                .body("code", equalTo("NO_CONTINGENCY_RESULT"));
        Api.runContingencies(id).then().statusCode(200);
        given().get("/api/sessions/{id}/analyses/n-1/{c}", id, "branch:nope")
                .then()
                .statusCode(404)
                .body("code", equalTo("UNKNOWN_CONTINGENCY"));
        Api.loadFactor(id, 0.8).then().statusCode(200);
        given().get("/api/sessions/{id}/analyses/n-1/{c}", id, "branch:L6-12")
                .then()
                .statusCode(404)
                .body("code", equalTo("NO_CONTINGENCY_RESULT"));
    }

    @Test
    void theCascadeAtBaseLoadStartingWithLineL24EndsNonConverged() {
        String id = Api.createSession();

        JsonNode cascade = Api.json(Api.cascade(id, Map.of("trigger", "branch:L2-4")));

        assertThat(cascade.get("end").asText()).isEqualTo("NON_CONVERGED");
        assertThat(trippedIds(cascade))
                .containsExactly("branch:L2-4", "branch:L4-5", "branch:L6-11", "branch:L13-14");
        assertThat(cascade.get("label").asText()).contains("Educational simplification");
        assertThat(list(cascade.get("steps")).get(0).has("tripped")).isFalse();
        assertThat(cascade.get("steps").size()).isEqualTo(5);
        assertThat(list(cascade.get("steps")))
                .allSatisfy(step -> assertThat(step.get("state").get("buses")).hasSize(14));
    }

    @Test
    void theCascadeAtHighLoadStartingWithLineL612SettlesAfterTwoMoreTrips() {
        String id = Api.createSession();
        Api.loadFactor(id, 1.2).then().statusCode(200);

        JsonNode cascade = Api.json(Api.cascade(id, Map.of("trigger", "branch:L6-12")));

        assertThat(cascade.get("end").asText()).isEqualTo("STABLE");
        assertThat(trippedIds(cascade))
                .containsExactly("branch:L6-12", "branch:L6-13", "branch:L9-14");
        assertThat(cascade.get("trippedCount").asInt()).isEqualTo(3);
        JsonNode second = list(cascade.get("steps")).get(2);
        assertThat(second.get("loadingAtTrip").asDouble()).isGreaterThan(1.2);
        assertThat(second.get("outOfServiceBranches")).hasSize(2);
    }

    @Test
    void theCascadeOptionsAreHonouredAndTheResultIsKept() {
        String id = Api.createSession();

        JsonNode cascade =
                Api.json(
                        Api.cascade(
                                id,
                                Map.of(
                                        "trigger",
                                        "generator:G2",
                                        "tripThreshold",
                                        2.0,
                                        "maxSteps",
                                        3)));

        assertThat(cascade.get("tripThreshold").asDouble()).isEqualTo(2.0);
        given().get("/api/sessions/{id}/analyses/cascade", id)
                .then()
                .statusCode(200)
                .body("steps", hasSize(cascade.get("steps").size()));
    }

    @Test
    void cascadeInputIsValidated() {
        String id = Api.createSession();

        Api.cascade(id, Map.of("trigger", "branch:nope"))
                .then()
                .statusCode(400)
                .body("code", equalTo("INVALID_INPUT"));
        Api.cascade(id, Map.of("trigger", "line")).then().statusCode(400);
        Api.cascade(id, Map.of("trigger", "branch:L2-4", "tripThreshold", 0.1))
                .then()
                .statusCode(400);
        Api.cascade(id, Map.of("trigger", "branch:L2-4", "maxSteps", 0)).then().statusCode(400);
        Api.cascade(id, Map.of("tripThreshold", 1.2)).then().statusCode(400);
        given().get("/api/sessions/{id}/analyses/cascade", id)
                .then()
                .statusCode(404)
                .body("code", equalTo("NO_CASCADE_RESULT"));
    }

    @Test
    void analysesOnAnUnknownSessionAre404() {
        String missing = "ffffffffffffffffffffffffffffffff";

        Api.runContingencies(missing).then().statusCode(404);
        Api.cascade(missing, Map.of("trigger", "branch:L2-4")).then().statusCode(404);
        given().get("/api/sessions/{id}/analyses/n-1/{c}", missing, "branch:L2-4")
                .then()
                .statusCode(404)
                .body("code", equalTo("UNKNOWN_SESSION"));
    }
}
