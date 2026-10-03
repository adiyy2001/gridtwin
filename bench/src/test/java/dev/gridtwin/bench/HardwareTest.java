package dev.gridtwin.bench;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class HardwareTest {

    @Test
    void theDetectedHeaderNamesTheMachine() {
        Hardware hardware = Hardware.detect();

        assertThat(hardware.cpuModel()).isNotBlank();
        assertThat(hardware.logicalCores()).isPositive();
        assertThat(hardware.physicalMemoryMegabytes()).isPositive();
        assertThat(hardware.operatingSystem()).contains(System.getProperty("os.name"));
        assertThat(hardware.jvm()).contains(System.getProperty("java.vm.name"));
        assertThat(hardware.maxHeapMegabytes()).isPositive();
        assertThat(hardware.describe())
                .contains(hardware.cpuModel())
                .contains(hardware.logicalCores() + " logical cores");
    }

    @Test
    void theCpuModelIsTheFirstModelNameLine() {
        List<String> lines =
                List.of(
                        "processor\t: 0",
                        "model name\t: Test CPU @ 3.00GHz",
                        "model name\t: Other");

        assertThat(Hardware.modelFrom(lines)).contains("Test CPU @ 3.00GHz");
        assertThat(Hardware.modelFrom(List.of("processor\t: 0"))).isEmpty();
    }
}
