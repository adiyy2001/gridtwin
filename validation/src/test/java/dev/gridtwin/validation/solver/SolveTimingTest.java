package dev.gridtwin.validation.solver;

import static org.assertj.core.api.Assertions.assertThat;

import dev.gridtwin.cases.CaseLoader;
import dev.gridtwin.domain.model.Network;
import dev.gridtwin.domain.powerflow.PowerFlow;
import dev.gridtwin.domain.powerflow.PowerFlowResult;
import org.junit.jupiter.api.Test;

class SolveTimingTest {

    private static final int WARM_UP_RUNS = 200;
    private static final int TIMED_RUNS = 200;

    @Test
    void printsTheIeee30SolveTimeAfterWarmUp() {
        Network network = CaseLoader.load("ieee30").network();
        PowerFlow powerFlow = PowerFlow.standard();
        PowerFlowResult last = null;
        for (int run = 0; run < WARM_UP_RUNS; run++) {
            last = powerFlow.solve(network);
        }
        long start = System.nanoTime();
        for (int run = 0; run < TIMED_RUNS; run++) {
            last = powerFlow.solve(network);
        }
        double averageMilliseconds = (System.nanoTime() - start) / 1e6 / TIMED_RUNS;

        System.out.printf(
                "ieee30 solve: %.3f ms average over %d runs after %d warm-up runs, %d iterations%n",
                averageMilliseconds, TIMED_RUNS, WARM_UP_RUNS, last.iterations());
        assertThat(last.converged()).isTrue();
    }
}
