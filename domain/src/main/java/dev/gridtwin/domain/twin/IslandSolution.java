package dev.gridtwin.domain.twin;

import dev.gridtwin.domain.powerflow.PowerFlowResult;
import dev.gridtwin.domain.topology.Island;
import java.util.Optional;

public record IslandSolution(
        Island island, IslandState state, Optional<PowerFlowResult> result, double shedLoadMw) {

    public Optional<Integer> slackBus() {
        return this.island.slack().map(slack -> slack.bus());
    }
}
