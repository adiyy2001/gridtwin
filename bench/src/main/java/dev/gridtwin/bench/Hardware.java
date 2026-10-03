package dev.gridtwin.bench;

import java.io.IOException;
import java.lang.management.ManagementFactory;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

public record Hardware(
        String cpuModel,
        int logicalCores,
        long physicalMemoryMegabytes,
        String operatingSystem,
        String jvm,
        long maxHeapMegabytes) {

    private static final Path CPU_INFO = Path.of("/proc/cpuinfo");
    private static final long MEGABYTE = 1024L * 1024L;

    public static Hardware detect() {
        return new Hardware(
                readCpuModel(),
                Runtime.getRuntime().availableProcessors(),
                readPhysicalMemory() / MEGABYTE,
                System.getProperty("os.name")
                        + " "
                        + System.getProperty("os.version")
                        + " ("
                        + System.getProperty("os.arch")
                        + ")",
                System.getProperty("java.vm.name")
                        + " "
                        + System.getProperty("java.runtime.version")
                        + " ("
                        + System.getProperty("java.vendor")
                        + ")",
                Runtime.getRuntime().maxMemory() / MEGABYTE);
    }

    static Optional<String> modelFrom(List<String> cpuInfoLines) {
        return cpuInfoLines.stream()
                .filter(line -> line.startsWith("model name"))
                .map(line -> line.substring(line.indexOf(':') + 1).trim())
                .findFirst();
    }

    private static String readCpuModel() {
        try {
            return modelFrom(Files.readAllLines(CPU_INFO))
                    .orElse("unknown CPU (" + System.getProperty("os.arch") + ")");
        } catch (IOException | RuntimeException exception) {
            return "unknown CPU (" + System.getProperty("os.arch") + ")";
        }
    }

    private static long readPhysicalMemory() {
        if (ManagementFactory.getOperatingSystemMXBean()
                instanceof com.sun.management.OperatingSystemMXBean extended) {
            return extended.getTotalMemorySize();
        }
        return 0L;
    }

    public String describe() {
        return "%s, %d logical cores, %d MB RAM, %s, %s, max heap %d MB"
                .formatted(
                        this.cpuModel,
                        this.logicalCores,
                        this.physicalMemoryMegabytes,
                        this.operatingSystem,
                        this.jvm,
                        this.maxHeapMegabytes);
    }
}
