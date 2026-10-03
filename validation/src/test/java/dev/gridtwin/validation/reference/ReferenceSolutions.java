package dev.gridtwin.validation.reference;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.net.URISyntaxException;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;

public final class ReferenceSolutions {

    private static final String DIRECTORY = "/reference/";

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private ReferenceSolutions() {}

    public static ReferenceSolution load(String fileName) {
        try (InputStream stream =
                ReferenceSolutions.class.getResourceAsStream(DIRECTORY + fileName)) {
            if (stream == null) {
                throw new IllegalArgumentException("no reference file " + fileName);
            }
            return MAPPER.readValue(stream, ReferenceSolution.class);
        } catch (IOException exception) {
            throw new UncheckedIOException(exception);
        }
    }

    public static ReferenceSolution load(String caseId, double loadFactor, String variant) {
        return load("%s-lf%03d-%s.json".formatted(caseId, Math.round(loadFactor * 100), variant));
    }

    public static List<String> fileNames() {
        try {
            URL directory = ReferenceSolutions.class.getResource(DIRECTORY);
            if (directory == null) {
                return List.of();
            }
            try (Stream<Path> files = Files.list(Path.of(directory.toURI()))) {
                return files.map(path -> path.getFileName().toString())
                        .filter(name -> name.endsWith(".json"))
                        .sorted()
                        .toList();
            }
        } catch (IOException exception) {
            throw new UncheckedIOException(exception);
        } catch (URISyntaxException exception) {
            throw new IllegalStateException(exception);
        }
    }
}
