package dev.gridtwin.domain.contingency;

import dev.gridtwin.domain.contingency.Violation.BranchOverload;
import dev.gridtwin.domain.contingency.Violation.IslandCollapse;
import dev.gridtwin.domain.contingency.Violation.LoadShed;
import dev.gridtwin.domain.contingency.Violation.SlackAboveLimit;
import dev.gridtwin.domain.contingency.Violation.VoltageOutOfBand;
import dev.gridtwin.domain.model.Generator;
import dev.gridtwin.domain.powerflow.BranchResult;
import dev.gridtwin.domain.powerflow.BusResult;
import dev.gridtwin.domain.powerflow.GeneratorResult;
import dev.gridtwin.domain.powerflow.PowerFlowResult;
import dev.gridtwin.domain.twin.GridSolution;
import dev.gridtwin.domain.twin.IslandSolution;
import dev.gridtwin.domain.twin.IslandState;
import java.util.ArrayList;
import java.util.List;

public final class Assessment {

    private static final double NEGLIGIBLE_MW = 1e-6;

    private final ContingencyOptions options;

    public Assessment(ContingencyOptions options) {
        this.options = options;
    }

    public Result assess(GridSolution solution) {
        List<Violation> violations = new ArrayList<>();
        double overload = 0.0;
        double voltage = 0.0;
        double slack = 0.0;
        for (IslandSolution island : solution.islands()) {
            if (island.state() == IslandState.COLLAPSED) {
                violations.add(new IslandCollapse(island.island().id()));
                continue;
            }
            if (island.state() == IslandState.DEENERGIZED) {
                continue;
            }
            PowerFlowResult result = island.result().orElseThrow();
            overload += this.collectOverloads(result, violations);
            voltage += this.collectVoltages(result, violations);
            slack += this.collectSlackExcess(island, result, violations);
        }
        double shed = this.collectShed(solution, violations);
        SeverityWeights weights = this.options.weights();
        double shedTerm = shed * weights.shedLoad();
        Severity severity =
                new Severity(
                        this.tier(solution, violations),
                        weights.overload() * overload
                                + weights.voltage() * voltage
                                + shedTerm
                                + weights.slack() * slack,
                        weights.overload() * overload,
                        weights.voltage() * voltage,
                        shedTerm,
                        weights.slack() * slack);
        return new Result(violations, severity);
    }

    private double collectOverloads(PowerFlowResult result, List<Violation> violations) {
        double limit = this.options.limits().maxLoading();
        double sum = 0.0;
        for (BranchResult branch : result.branches()) {
            if (branch.loading() > limit) {
                violations.add(new BranchOverload(branch.id(), branch.loading()));
                double excess = branch.loading() - limit;
                sum += excess * excess;
            }
        }
        return sum;
    }

    private double collectVoltages(PowerFlowResult result, List<Violation> violations) {
        ViolationLimits limits = this.options.limits();
        double sum = 0.0;
        for (BusResult bus : result.buses()) {
            if (!bus.energized()) {
                continue;
            }
            double magnitude = bus.voltageMagnitude();
            if (magnitude < limits.minVoltage()) {
                violations.add(new VoltageOutOfBand(bus.number(), magnitude, Violation.Side.LOW));
                sum += square((limits.minVoltage() - magnitude) / limits.halfBand());
            } else if (magnitude > limits.maxVoltage()) {
                violations.add(new VoltageOutOfBand(bus.number(), magnitude, Violation.Side.HIGH));
                sum += square((magnitude - limits.maxVoltage()) / limits.halfBand());
            }
        }
        return sum;
    }

    private double collectSlackExcess(
            IslandSolution island, PowerFlowResult result, List<Violation> violations) {
        String slackId = island.island().slack().orElseThrow().generatorId();
        Generator generator =
                island.island().network().orElseThrow().generators().stream()
                        .filter(candidate -> candidate.id().equals(slackId))
                        .findFirst()
                        .orElseThrow();
        GeneratorResult output = result.generator(slackId).orElseThrow();
        double excess = output.activeMw() - generator.activeMaxMw();
        if (excess > NEGLIGIBLE_MW && generator.activeMaxMw() > 0.0) {
            violations.add(
                    new SlackAboveLimit(slackId, output.activeMw(), generator.activeMaxMw()));
            return square(excess / generator.activeMaxMw());
        }
        return 0.0;
    }

    private double collectShed(GridSolution solution, List<Violation> violations) {
        if (solution.shedLoadMw() <= NEGLIGIBLE_MW) {
            return 0.0;
        }
        violations.add(new LoadShed(solution.shedLoadMw()));
        return solution.totalLoadMw() > 0.0 ? solution.shedLoadMw() / solution.totalLoadMw() : 0.0;
    }

    private SeverityTier tier(GridSolution solution, List<Violation> violations) {
        if (!solution.converged()) {
            return SeverityTier.NON_CONVERGED;
        }
        boolean nothingServed =
                solution.islands().stream()
                                .noneMatch(island -> island.state() == IslandState.ENERGIZED)
                        || (solution.totalLoadMw() > 0.0
                                && solution.shedLoadMw() >= solution.totalLoadMw() - NEGLIGIBLE_MW);
        if (nothingServed) {
            return SeverityTier.BLACKOUT;
        }
        return violations.isEmpty() ? SeverityTier.SECURE : SeverityTier.DEGRADED;
    }

    private static double square(double value) {
        return value * value;
    }

    public record Result(List<Violation> violations, Severity severity) {

        public Result {
            violations = List.copyOf(violations);
        }
    }
}
