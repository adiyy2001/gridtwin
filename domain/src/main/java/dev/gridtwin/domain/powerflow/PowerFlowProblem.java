package dev.gridtwin.domain.powerflow;

import dev.gridtwin.domain.model.BusType;
import java.util.stream.IntStream;

record PowerFlowProblem(
        BusIndex index,
        Ybus ybus,
        BusType[] roles,
        double[] activeSpecified,
        double[] reactiveSpecified,
        double[] magnitudeSetpoints) {

    int[] angleBuses() {
        return IntStream.range(0, this.roles.length)
                .filter(bus -> this.roles[bus] != BusType.REFERENCE)
                .toArray();
    }

    int[] magnitudeBuses() {
        return IntStream.range(0, this.roles.length)
                .filter(bus -> this.roles[bus] == BusType.PQ)
                .toArray();
    }

    int referenceBus() {
        return IntStream.range(0, this.roles.length)
                .filter(bus -> this.roles[bus] == BusType.REFERENCE)
                .findFirst()
                .orElseThrow();
    }
}
