package dev.gridtwin.cases;

import com.fasterxml.jackson.core.JacksonException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.gridtwin.domain.topology.Substation;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Optional;

public final class CaseLoader {

    private static final List<String> CASE_IDS = List.of("ieee14", "ieee30");

    private static final ObjectMapper MAPPER =
            new ObjectMapper().enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);

    private CaseLoader() {}

    public static List<String> availableIds() {
        return CASE_IDS;
    }

    private static Optional<Substation> loadSubstation(String id) throws IOException {
        try (InputStream stream =
                CaseLoader.class.getResourceAsStream("/cases/" + id + ".substation.json")) {
            if (stream == null) {
                return Optional.empty();
            }
            return Optional.of(MAPPER.readValue(stream, SubstationDocument.class).toSubstation());
        }
    }

    public static CaseData load(String id) {
        if (!CASE_IDS.contains(id)) {
            throw new CaseLoadException("unknown case '" + id + "', available: " + CASE_IDS);
        }
        String resource = "/cases/" + id + ".json";
        try (InputStream stream = CaseLoader.class.getResourceAsStream(resource)) {
            if (stream == null) {
                throw new CaseLoadException("resource " + resource + " is missing");
            }
            return MAPPER.readValue(stream, CaseDocument.class).toCaseData(loadSubstation(id));
        } catch (JacksonException | IllegalArgumentException exception) {
            throw new CaseLoadException(
                    "case '" + id + "' is invalid: " + exception.getMessage(), exception);
        } catch (IOException exception) {
            throw new CaseLoadException("case '" + id + "' could not be read", exception);
        }
    }
}
