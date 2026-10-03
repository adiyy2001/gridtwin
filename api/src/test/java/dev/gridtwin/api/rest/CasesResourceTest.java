package dev.gridtwin.api.rest;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

@QuarkusTest
class CasesResourceTest {

    @Test
    void listsOnlyTheCasesThatHaveASubstation() {
        given().get("/api/cases")
                .then()
                .statusCode(200)
                .body("$", hasSize(1))
                .body("[0].id", equalTo("ieee14"))
                .body("[0].buses", equalTo(14))
                .body("[0].branches", equalTo(20));
    }

    @Test
    void theDetailCarriesTheStaticDataAndTheEducationalDisclaimer() {
        given().get("/api/cases/ieee14")
                .then()
                .statusCode(200)
                .body("disclaimer", containsString("Educational"))
                .body("buses", hasSize(14))
                .body("buses[0].x", notNullValue())
                .body("branches", hasSize(20))
                .body("generators", hasSize(5))
                .body("loads", hasSize(11))
                .body("substation.bus", equalTo(4))
                .body("substation.busbars", hasSize(2))
                .body("substation.bays", hasSize(7))
                .body("substation.switches", hasSize(35))
                .body("provenance.source", containsString("MATPOWER"));
    }

    @Test
    void anUnknownCaseIs404() {
        given().get("/api/cases/nope").then().statusCode(404).body("code", equalTo("UNKNOWN_CASE"));
        given().get("/api/cases/ieee30").then().statusCode(404);
    }
}
