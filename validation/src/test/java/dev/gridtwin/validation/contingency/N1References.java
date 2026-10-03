package dev.gridtwin.validation.contingency;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;

public final class N1References {

    private static final ObjectMapper MAPPER =
            new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    private N1References() {}

    public static N1Reference load(String caseId, String variant) {
        String path = "/reference/n1/%s-n1-%s.json".formatted(caseId, variant);
        try (InputStream stream = N1References.class.getResourceAsStream(path)) {
            if (stream == null) {
                throw new IllegalArgumentException("no reference file " + path);
            }
            return MAPPER.readValue(stream, N1Reference.class);
        } catch (IOException exception) {
            throw new UncheckedIOException(exception);
        }
    }
}
