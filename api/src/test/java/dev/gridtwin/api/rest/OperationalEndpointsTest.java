package dev.gridtwin.api.rest;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.equalTo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import io.quarkus.test.junit.QuarkusTest;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.Test;

@QuarkusTest
class OperationalEndpointsTest {

    private static final ObjectMapper MAPPER =
            new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);

    private static Path committedFile() {
        return Path.of(
                System.getProperty("gridtwin.repository-root"), "docs", "api", "openapi.json");
    }

    @Test
    void theHealthEndpointReportsUp() {
        given().get("/q/health").then().statusCode(200).body("status", equalTo("UP"));
        given().get("/q/health/ready").then().statusCode(200).body("status", equalTo("UP"));
    }

    @Test
    void theServedOpenApiDocumentEqualsTheCommittedFile() throws IOException {
        JsonNode served = MAPPER.readTree(given().get("/q/openapi?format=json").asString());
        if (Boolean.parseBoolean(System.getProperty("gridtwin.openapi.update"))) {
            Files.createDirectories(committedFile().getParent());
            Files.writeString(committedFile(), MAPPER.writeValueAsString(served) + "\n");
        }

        assertThat(committedFile()).exists();
        assertThat(served)
                .describedAs(
                        "docs/api/openapi.json is out of date, run tools/gen-api-types.sh --refresh")
                .isEqualTo(MAPPER.readTree(committedFile().toFile()));
    }

    @Test
    void everyOperationHasASummaryAndEveryNonNullablePropertyIsRequired() {
        JsonNode served = Api.json(given().get("/q/openapi?format=json"));

        served.get("paths")
                .forEach(
                        path ->
                                path.forEach(
                                        operation ->
                                                assertThat(operation.has("summary")).isTrue()));
        served.get("components")
                .get("schemas")
                .forEach(
                        schema -> {
                            Set<String> required = new HashSet<>();
                            schema.path("required").forEach(name -> required.add(name.asText()));
                            schema.path("properties")
                                    .properties()
                                    .forEach(
                                            property ->
                                                    assertThat(required.contains(property.getKey()))
                                                            .isEqualTo(
                                                                    !allowsNull(
                                                                            property.getValue())));
                        });
    }

    private static boolean allowsNull(JsonNode schema) {
        JsonNode type = schema.path("type");
        if (type.isArray()) {
            return StreamSupport.stream(type.spliterator(), false)
                    .anyMatch(entry -> entry.asText().equals("null"));
        }
        if (type.asText().equals("null")) {
            return true;
        }
        return StreamSupport.stream(schema.path("anyOf").spliterator(), false)
                .anyMatch(OperationalEndpointsTest::allowsNull);
    }
}
