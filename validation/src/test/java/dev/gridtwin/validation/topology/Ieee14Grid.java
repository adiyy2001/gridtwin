package dev.gridtwin.validation.topology;

import dev.gridtwin.cases.CaseLoader;
import dev.gridtwin.domain.powerflow.EjmlSparseLuSolver;
import dev.gridtwin.domain.powerflow.PowerFlow;
import dev.gridtwin.domain.powerflow.PowerFlowOptions;
import dev.gridtwin.domain.topology.Position;
import dev.gridtwin.domain.twin.GridModel;
import dev.gridtwin.domain.twin.Twin;
import dev.gridtwin.domain.twin.TwinSolver;

final class Ieee14Grid {

    static final String COUPLER_BREAKER = "CPL.QA1";

    private Ieee14Grid() {}

    static GridModel model() {
        return CaseLoader.load("ieee14").gridModel().orElseThrow();
    }

    static TwinSolver solverWithoutReactiveLimits() {
        return new TwinSolver(
                new PowerFlow(
                        PowerFlowOptions.standard().withReactiveLimits(false),
                        EjmlSparseLuSolver::new));
    }

    static Twin twinWithoutReactiveLimits() {
        return Twin.start(solverWithoutReactiveLimits(), model());
    }

    static Twin openCoupler(Twin twin) {
        return twin.operate(COUPLER_BREAKER, Position.OPEN).twin();
    }
}
