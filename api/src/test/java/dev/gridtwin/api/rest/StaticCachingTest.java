package dev.gridtwin.api.rest;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

@QuarkusTest
class StaticCachingTest {

    private static final String REVALIDATE_ALWAYS = "no-cache";
    private static final String FINGERPRINTED = "public, immutable, max-age=31536000";

    @Test
    void theRootDocumentIsRevalidatedOnEveryLoad() {
        given().get("/").then().statusCode(200).header("Cache-Control", equalTo(REVALIDATE_ALWAYS));
    }

    @Test
    void theIndexDocumentIsRevalidatedOnEveryLoad() {
        given().get("/index.html")
                .then()
                .statusCode(200)
                .header("Cache-Control", equalTo(REVALIDATE_ALWAYS));
    }

    @Test
    void fingerprintedAssetsAreCachedForAYear() {
        given().get("/fingerprinted-ABCD1234.js")
                .then()
                .statusCode(200)
                .header("Cache-Control", equalTo(FINGERPRINTED));
    }
}
