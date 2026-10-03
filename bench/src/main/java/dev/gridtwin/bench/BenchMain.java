package dev.gridtwin.bench;

import java.io.IOException;
import java.io.PrintStream;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

public final class BenchMain {

    private static final String DEFAULT_OUTPUT = "bench/results";

    private BenchMain() {}

    public static void main(String[] arguments) throws IOException {
        System.exit(run(List.of(arguments), System.out));
    }

    public static int run(List<String> arguments, PrintStream out) throws IOException {
        Settings settings = arguments.contains("--quick") ? Settings.quick() : Settings.standard();
        Path output = Path.of(valueOf(arguments, "--output").orElse(DEFAULT_OUTPUT));
        Report report = new JavaSuite(settings).run();
        out.print(ReportWriter.format(report));
        Path written = ReportWriter.write(report, output);
        out.println("results written to " + written);
        return 0;
    }

    private static Optional<String> valueOf(List<String> arguments, String flag) {
        int position = arguments.indexOf(flag);
        if (position < 0 || position + 1 >= arguments.size()) {
            return Optional.empty();
        }
        return Optional.of(arguments.get(position + 1));
    }
}
