package dev.gridtwin.api.dto;

import dev.gridtwin.domain.model.Branch;
import dev.gridtwin.domain.model.BusType;
import dev.gridtwin.domain.model.Network;
import dev.gridtwin.domain.powerflow.BranchResult;
import dev.gridtwin.domain.powerflow.BusResult;
import dev.gridtwin.domain.powerflow.BusState;
import dev.gridtwin.domain.powerflow.CollapseReason;
import dev.gridtwin.domain.powerflow.GeneratorResult;
import dev.gridtwin.domain.powerflow.PowerFlowResult;
import dev.gridtwin.domain.powerflow.ReactiveLimitState;
import dev.gridtwin.domain.topology.NodeSet;
import dev.gridtwin.domain.topology.NodeState;
import dev.gridtwin.domain.topology.Position;
import dev.gridtwin.domain.twin.GridSolution;
import dev.gridtwin.domain.twin.IslandSolution;
import dev.gridtwin.domain.twin.IslandState;
import dev.gridtwin.domain.twin.TwinState;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.OptionalDouble;

public record StateDto(
        String caseId,
        double loadFactor,
        boolean converged,
        SummaryDto summary,
        List<String> warnings,
        List<SwitchStateDto> switches,
        List<NodeStateDto> nodes,
        List<IslandDto> islands,
        List<BusDto> buses,
        List<BranchDto> branches,
        List<GeneratorDto> generators) {

    public static StateDto from(TwinState state, GridSolution solution) {
        Network network = solution.topology().network();
        return new StateDto(
                state.model().network().id(),
                state.loadFactor(),
                solution.converged(),
                SummaryDto.from(solution),
                solution.warnings(),
                switchesOf(state),
                solution.topology().nodeSets().stream().flatMap(StateDto::nodesOf).toList(),
                solution.islands().stream().map(IslandDto::from).toList(),
                solution.buses().stream().map(bus -> BusDto.from(bus, network)).toList(),
                solution.branches().stream()
                        .map(branch -> BranchDto.from(branch, network))
                        .toList(),
                solution.generators().stream().map(GeneratorDto::from).toList());
    }

    private static List<SwitchStateDto> switchesOf(TwinState state) {
        return state.model().substation().switches().stream()
                .map(
                        candidate ->
                                new SwitchStateDto(
                                        candidate.id(), state.positions().of(candidate.id())))
                .toList();
    }

    private static java.util.stream.Stream<NodeStateDto> nodesOf(NodeSet set) {
        return set.nodes().stream().map(node -> new NodeStateDto(node, set.state()));
    }

    public record SwitchStateDto(String id, Position position) {}

    public record NodeStateDto(String id, NodeState state) {}

    public record SummaryDto(
            double totalLoadMw,
            double servedLoadMw,
            double shedLoadMw,
            double totalGenerationMw,
            double totalLossMw,
            double maxLoading,
            Optional<Double> lowestVoltage,
            int overloadedBranches) {

        static SummaryDto from(GridSolution solution) {
            OptionalDouble lowest = solution.lowestVoltage();
            return new SummaryDto(
                    Numbers.finite(solution.totalLoadMw()),
                    Numbers.finite(solution.totalLoadMw() - solution.shedLoadMw()),
                    Numbers.finite(solution.shedLoadMw()),
                    Numbers.finite(solution.totalGenerationMw()),
                    Numbers.finite(solution.totalLossMw()),
                    Numbers.finite(solution.maxLoading()),
                    lowest.isPresent() ? Optional.of(lowest.getAsDouble()) : Optional.empty(),
                    solution.overloadedBranches().size());
        }
    }

    public record IslandDto(
            String id,
            IslandState state,
            List<Integer> buses,
            Optional<Integer> slackBus,
            Optional<String> slackGenerator,
            double shedLoadMw,
            Optional<Integer> iterations,
            Optional<Integer> reactiveLimitRounds,
            Optional<CollapseReason> collapseReason,
            List<Double> mismatchHistory) {

        static IslandDto from(IslandSolution island) {
            Optional<PowerFlowResult> result = island.result();
            return new IslandDto(
                    island.island().id(),
                    island.state(),
                    island.island().buses().stream().sorted(Comparator.naturalOrder()).toList(),
                    island.slackBus(),
                    island.island().slack().map(slack -> slack.generatorId()),
                    Numbers.finite(island.shedLoadMw()),
                    result.map(PowerFlowResult::iterations),
                    result.map(PowerFlowResult::reactiveLimitRounds),
                    result.flatMap(PowerFlowResult::collapseReason),
                    result.map(PowerFlowResult::mismatchHistory).orElse(List.of()).stream()
                            .map(Numbers::finite)
                            .toList());
        }
    }

    public record BusDto(
            int number,
            BusType type,
            BusState state,
            double baseKv,
            double voltageMagnitude,
            double voltageKv,
            double angleDegrees,
            double activeGenerationMw,
            double reactiveGenerationMvar,
            double activeLoadMw,
            double reactiveLoadMvar) {

        static BusDto from(BusResult bus, Network network) {
            double baseKv = network.findBus(bus.number()).map(found -> found.baseKv()).orElse(0.0);
            return new BusDto(
                    bus.number(),
                    bus.type(),
                    bus.state(),
                    baseKv,
                    Numbers.finite(bus.voltageMagnitude()),
                    Numbers.finite(bus.voltageMagnitude() * baseKv),
                    Numbers.finite(bus.angleDegrees()),
                    Numbers.finite(bus.activeGenerationMw()),
                    Numbers.finite(bus.reactiveGenerationMvar()),
                    Numbers.finite(bus.activeLoadMw()),
                    Numbers.finite(bus.reactiveLoadMvar()));
        }
    }

    public record BranchDto(
            String id,
            int from,
            int to,
            boolean inService,
            boolean energized,
            double ratingMva,
            double activeFromMw,
            double reactiveFromMvar,
            double activeToMw,
            double reactiveToMvar,
            double currentFromKa,
            double currentToKa,
            double loading,
            double lossMw,
            boolean overloaded) {

        static BranchDto from(BranchResult branch, Network network) {
            Optional<Branch> element = network.findBranch(branch.id());
            return new BranchDto(
                    branch.id(),
                    branch.from(),
                    branch.to(),
                    element.map(Branch::inService).orElse(false),
                    branch.energized(),
                    element.map(Branch::ratingMva).orElse(0.0),
                    Numbers.finite(branch.activeFromMw()),
                    Numbers.finite(branch.reactiveFromMvar()),
                    Numbers.finite(branch.activeToMw()),
                    Numbers.finite(branch.reactiveToMvar()),
                    Numbers.finite(branch.currentFromKa()),
                    Numbers.finite(branch.currentToKa()),
                    Numbers.finite(branch.loading()),
                    Numbers.finite(branch.lossMw()),
                    branch.overloaded());
        }
    }

    public record GeneratorDto(
            String id,
            int bus,
            boolean inService,
            double activeMw,
            double reactiveMvar,
            ReactiveLimitState reactiveLimit) {

        static GeneratorDto from(GeneratorResult generator) {
            return new GeneratorDto(
                    generator.id(),
                    generator.bus(),
                    generator.inService(),
                    Numbers.finite(generator.activeMw()),
                    Numbers.finite(generator.reactiveMvar()),
                    generator.reactiveLimit());
        }
    }
}
