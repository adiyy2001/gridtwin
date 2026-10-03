package dev.gridtwin.validation.topology;

import dev.gridtwin.domain.topology.Position;
import dev.gridtwin.domain.topology.Substation;
import dev.gridtwin.domain.topology.Switch;
import dev.gridtwin.domain.topology.SwitchKind;
import dev.gridtwin.domain.twin.TwinState;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

final class SwitchingSequences {

    private static final int MAX_LENGTH = 25;
    private static final int LOAD_STEP_PERCENT = 10;

    private SwitchingSequences() {}

    static List<SwitchingStep> generate(Random random, Substation substation) {
        int length = 1 + random.nextInt(MAX_LENGTH);
        List<Switch> switches = substation.switches();
        List<SwitchingStep> steps = new ArrayList<>();
        for (int position = 0; position < length; position++) {
            if (random.nextInt(100) < LOAD_STEP_PERCENT) {
                double factor =
                        TwinState.MIN_LOAD_FACTOR
                                + random.nextDouble()
                                        * (TwinState.MAX_LOAD_FACTOR - TwinState.MIN_LOAD_FACTOR);
                steps.add(new SwitchingStep.ScaleLoad(factor));
            } else {
                Switch chosen = pick(random, switches);
                steps.add(
                        new SwitchingStep.Operate(
                                chosen.id(),
                                random.nextBoolean() ? Position.OPEN : Position.CLOSED));
            }
        }
        return List.copyOf(steps);
    }

    private static Switch pick(Random random, List<Switch> switches) {
        List<Switch> weighted = new ArrayList<>(switches);
        switches.stream()
                .filter(candidate -> candidate.kind() == SwitchKind.BREAKER)
                .forEach(
                        breaker -> {
                            weighted.add(breaker);
                            weighted.add(breaker);
                        });
        return weighted.get(random.nextInt(weighted.size()));
    }
}
