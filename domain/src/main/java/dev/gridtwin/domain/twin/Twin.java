package dev.gridtwin.domain.twin;

import dev.gridtwin.domain.topology.OperationResult;
import dev.gridtwin.domain.topology.Position;

public record Twin(TwinSolver solver, TwinState state, TwinSolution solution) {

    public static Twin start(TwinSolver solver, GridModel model) {
        TwinState initial = model.initialState();
        return new Twin(solver, initial, solver.solve(initial));
    }

    public Step operate(String switchId, Position target) {
        TwinState.Switching switching = this.state.operate(switchId, target);
        if (!(switching.result() instanceof OperationResult.Accepted accepted)
                || !accepted.changed()) {
            return new Step(switching.result(), this);
        }
        TwinSolution next = this.solver.solve(switching.state(), this.solution.warmStart());
        return new Step(switching.result(), new Twin(this.solver, switching.state(), next));
    }

    public Twin withLoadFactor(double factor) {
        TwinState next = this.state.withLoadFactor(factor);
        return new Twin(this.solver, next, this.solver.solve(next, this.solution.warmStart()));
    }

    public record Step(OperationResult result, Twin twin) {}
}
