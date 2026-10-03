package dev.gridtwin.domain.twin;

import dev.gridtwin.domain.model.Network;
import dev.gridtwin.domain.topology.Interlocks;
import dev.gridtwin.domain.topology.OperationResult;
import dev.gridtwin.domain.topology.Position;
import dev.gridtwin.domain.topology.SwitchPositions;
import dev.gridtwin.domain.topology.Topology;
import dev.gridtwin.domain.topology.TopologyProcessor;

public record TwinState(GridModel model, double loadFactor, SwitchPositions positions) {

    public static final double MIN_LOAD_FACTOR = 0.5;
    public static final double MAX_LOAD_FACTOR = 1.5;

    public TwinState {
        if (!(loadFactor >= MIN_LOAD_FACTOR && loadFactor <= MAX_LOAD_FACTOR)) {
            throw new IllegalArgumentException(
                    "load factor must be between "
                            + MIN_LOAD_FACTOR
                            + " and "
                            + MAX_LOAD_FACTOR
                            + ": "
                            + loadFactor);
        }
    }

    public static TwinState initial(GridModel model) {
        return new TwinState(model, 1.0, model.substation().initialPositions());
    }

    public Network network() {
        return this.model.network().withLoadFactor(this.loadFactor);
    }

    public Topology topology() {
        return TopologyProcessor.process(this.network(), this.model.substation(), this.positions);
    }

    public TwinState withLoadFactor(double factor) {
        return new TwinState(this.model, factor, this.positions);
    }

    public Switching operate(String switchId, Position target) {
        OperationResult result =
                Interlocks.check(
                        this.model.substation(), this.topology(), this.positions, switchId, target);
        if (result instanceof OperationResult.Accepted accepted && accepted.changed()) {
            return new Switching(
                    result,
                    new TwinState(
                            this.model, this.loadFactor, this.positions.with(switchId, target)));
        }
        return new Switching(result, this);
    }

    public record Switching(OperationResult result, TwinState state) {}
}
