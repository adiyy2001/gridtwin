package dev.gridtwin.api.config;

import static org.assertj.core.api.Assertions.assertThat;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.util.concurrent.ForkJoinPool;
import org.junit.jupiter.api.Test;

@QuarkusTest
class ApplicationBeansTest {

    @Inject ForkJoinPool pool;

    @Test
    void theContingencyPoolUsesOneWorkerPerCore() {
        assertThat(this.pool.getParallelism())
                .isEqualTo(Runtime.getRuntime().availableProcessors());
        assertThat(this.pool.isShutdown()).isFalse();
    }
}
