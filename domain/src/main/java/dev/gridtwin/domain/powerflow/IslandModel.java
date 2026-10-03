package dev.gridtwin.domain.powerflow;

import dev.gridtwin.domain.model.BusType;
import dev.gridtwin.domain.model.Generator;
import dev.gridtwin.domain.model.Load;
import dev.gridtwin.domain.model.Network;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

final class IslandModel {

    private final Network network;
    private final BusIndex index;
    private final Ybus ybus;
    private final BusType[] declaredTypes;
    private final double[] loadActive;
    private final double[] loadReactive;
    private final double[] tableActive;
    private final double[] tableReactive;
    private final double[] reactiveMax;
    private final double[] reactiveMin;
    private final double[] setpoints;
    private final List<List<Generator>> generators;

    IslandModel(Network network, BusIndex index) {
        int size = index.size();
        this.network = network;
        this.index = index;
        this.ybus = Ybus.build(network, index);
        this.declaredTypes = new BusType[size];
        this.loadActive = new double[size];
        this.loadReactive = new double[size];
        this.tableActive = new double[size];
        this.tableReactive = new double[size];
        this.reactiveMax = new double[size];
        this.reactiveMin = new double[size];
        this.setpoints = new double[size];
        this.generators = new ArrayList<>();
        for (int position = 0; position < size; position++) {
            this.generators.add(new ArrayList<>());
        }
        this.fill();
    }

    Network network() {
        return this.network;
    }

    BusIndex index() {
        return this.index;
    }

    Ybus ybus() {
        return this.ybus;
    }

    BusType declaredType(int position) {
        return this.declaredTypes[position];
    }

    List<Generator> generatorsAt(int position) {
        return this.generators.get(position);
    }

    double loadActive(int position) {
        return this.loadActive[position];
    }

    double loadReactive(int position) {
        return this.loadReactive[position];
    }

    double reactiveMax(int position) {
        return this.reactiveMax[position];
    }

    double reactiveMin(int position) {
        return this.reactiveMin[position];
    }

    double setpoint(int position) {
        return this.setpoints[position];
    }

    PowerFlowProblem problem(Map<Integer, ReactiveLimitState> converted) {
        int size = this.index.size();
        BusType[] roles = new BusType[size];
        double[] active = new double[size];
        double[] reactive = new double[size];
        for (int position = 0; position < size; position++) {
            roles[position] = this.roleOf(position, converted);
            active[position] = this.tableActive[position] - this.loadActive[position];
            reactive[position] =
                    this.reactiveGeneration(position, converted) - this.loadReactive[position];
        }
        return new PowerFlowProblem(this.index, this.ybus, roles, active, reactive, this.setpoints);
    }

    double reactiveGeneration(int position, Map<Integer, ReactiveLimitState> converted) {
        ReactiveLimitState limit = converted.getOrDefault(position, ReactiveLimitState.NONE);
        return switch (limit) {
            case UPPER -> this.reactiveMax[position];
            case LOWER -> this.reactiveMin[position];
            case NONE -> this.tableReactive[position];
        };
    }

    private BusType roleOf(int position, Map<Integer, ReactiveLimitState> converted) {
        BusType declared = this.declaredTypes[position];
        if (declared == BusType.PV
                && !this.generators.get(position).isEmpty()
                && !converted.containsKey(position)) {
            return BusType.PV;
        }
        return declared == BusType.REFERENCE ? BusType.REFERENCE : BusType.PQ;
    }

    private void fill() {
        double baseMva = this.network.baseMva();
        for (int position = 0; position < this.index.size(); position++) {
            int number = this.index.numberAt(position);
            var bus = this.network.findBus(number).orElseThrow();
            this.declaredTypes[position] = bus.type();
            this.setpoints[position] = bus.voltageMagnitude();
        }
        for (Load load : this.network.loads()) {
            this.index
                    .positionOf(load.bus())
                    .ifPresent(
                            position -> {
                                this.loadActive[position] += load.activePowerMw() / baseMva;
                                this.loadReactive[position] += load.reactivePowerMvar() / baseMva;
                            });
        }
        for (Generator generator : this.network.generators()) {
            if (!generator.inService()) {
                continue;
            }
            this.index
                    .positionOf(generator.bus())
                    .ifPresent(position -> this.addGenerator(position, generator, baseMva));
        }
    }

    private void addGenerator(int position, Generator generator, double baseMva) {
        if (this.generators.get(position).isEmpty()) {
            this.setpoints[position] = generator.voltageSetpoint();
        }
        this.generators.get(position).add(generator);
        this.tableActive[position] += generator.activePowerMw() / baseMva;
        this.tableReactive[position] += generator.reactivePowerMvar() / baseMva;
        this.reactiveMax[position] += generator.reactiveMaxMvar() / baseMva;
        this.reactiveMin[position] += generator.reactiveMinMvar() / baseMva;
    }
}
