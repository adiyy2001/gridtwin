package dev.gridtwin.domain.powerflow;

import dev.gridtwin.domain.model.Branch;
import dev.gridtwin.domain.model.Bus;
import dev.gridtwin.domain.model.BusType;
import dev.gridtwin.domain.model.Generator;
import dev.gridtwin.domain.model.Load;
import dev.gridtwin.domain.model.Network;
import dev.gridtwin.domain.model.Shunt;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

final class ResultAssembler {

    private static final double SQRT_THREE = Math.sqrt(3.0);

    private final IslandModel model;
    private final Network network;
    private final BusIndex index;

    ResultAssembler(IslandModel model) {
        this.model = model;
        this.network = model.network();
        this.index = model.index();
    }

    static PowerFlowResult withoutIsland(Network network) {
        return new ResultAssembler(new IslandModel(network, BusIndex.of(List.of())))
                .collapsed(
                        Map.of(),
                        new NewtonOutcome(
                                Optional.of(CollapseReason.SINGULAR_JACOBIAN),
                                0,
                                List.of(),
                                new double[0],
                                new double[0]),
                        0);
    }

    PowerFlowResult converged(
            PowerFlowProblem problem,
            NewtonOutcome outcome,
            Map<Integer, ReactiveLimitState> converted,
            int totalIterations,
            int rounds) {
        double baseMva = this.network.baseMva();
        double[] magnitudes = outcome.magnitudes();
        double[] angles = outcome.anglesRadians();
        Injections injections = problem.ybus().injections(magnitudes, angles);
        List<String> warnings = new ArrayList<>();
        List<GeneratorResult> generators =
                this.generatorResults(problem, injections, converted, warnings);
        List<BusResult> buses = this.busResults(problem, injections, converted, magnitudes, angles);
        List<BranchResult> branches = this.branchResults(magnitudes, angles);
        int referencePosition = problem.referenceBus();
        double slackActive =
                (injections.activePower()[referencePosition]
                                + this.model.loadActive(referencePosition))
                        * baseMva;
        double slackReactive =
                (injections.reactivePower()[referencePosition]
                                + this.model.loadReactive(referencePosition))
                        * baseMva;
        this.addSlackWarning(generators, slackActive, warnings);
        double energizedLoad = this.energizedLoadMw();
        double unserved = this.totalLoadMw() - energizedLoad;
        if (unserved > 0.0) {
            warnings.add(String.format(Locale.ROOT, "%.1f MW of load is not supplied", unserved));
        }
        return new PowerFlowResult(
                PowerFlowStatus.CONVERGED,
                Optional.empty(),
                totalIterations,
                rounds,
                outcome.mismatchHistory(),
                buses,
                branches,
                generators,
                this.network.referenceBus().number(),
                slackActive,
                slackReactive,
                energizedLoad,
                unserved,
                generators.stream().mapToDouble(GeneratorResult::activeMw).sum(),
                branches.stream().mapToDouble(BranchResult::lossMw).sum(),
                this.shuntConsumptionMw(magnitudes),
                warnings);
    }

    PowerFlowResult collapsed(
            Map<Integer, ReactiveLimitState> converted,
            NewtonOutcome outcome,
            int totalIterations) {
        CollapseReason reason = outcome.failure().orElseThrow();
        List<BusResult> buses =
                this.network.buses().stream().map(bus -> this.collapsedBus(bus)).toList();
        List<BranchResult> branches =
                this.network.branches().stream().map(ResultAssembler::deadBranch).toList();
        List<GeneratorResult> generators =
                this.network.generators().stream()
                        .map(
                                generator ->
                                        new GeneratorResult(
                                                generator.id(),
                                                generator.bus(),
                                                generator.inService(),
                                                0.0,
                                                0.0,
                                                ReactiveLimitState.NONE))
                        .toList();
        List<String> warnings =
                List.of(
                        "Voltage collapse: the power flow did not converge ("
                                + reason.name().toLowerCase(Locale.ROOT).replace('_', ' ')
                                + ")");
        return new PowerFlowResult(
                PowerFlowStatus.COLLAPSED,
                Optional.of(reason),
                totalIterations,
                converted.size(),
                outcome.mismatchHistory(),
                buses,
                branches,
                generators,
                this.network.referenceBus().number(),
                0.0,
                0.0,
                0.0,
                this.totalLoadMw(),
                0.0,
                0.0,
                0.0,
                warnings);
    }

    private BusResult collapsedBus(Bus bus) {
        boolean attempted = this.index.contains(bus.number());
        double[] loads = this.loadAt(bus.number());
        return new BusResult(
                bus.number(),
                BusType.ISOLATED,
                attempted ? BusState.COLLAPSED : BusState.DEENERGIZED,
                0.0,
                0.0,
                0.0,
                0.0,
                loads[0],
                loads[1]);
    }

    private double[] loadAt(int busNumber) {
        double active =
                this.network.loads().stream()
                        .filter(load -> load.bus() == busNumber)
                        .mapToDouble(Load::activePowerMw)
                        .sum();
        double reactive =
                this.network.loads().stream()
                        .filter(load -> load.bus() == busNumber)
                        .mapToDouble(Load::reactivePowerMvar)
                        .sum();
        return new double[] {active, reactive};
    }

    private double totalLoadMw() {
        return this.network.loads().stream().mapToDouble(Load::activePowerMw).sum();
    }

    private double energizedLoadMw() {
        return this.network.loads().stream()
                .filter(load -> this.index.contains(load.bus()))
                .mapToDouble(Load::activePowerMw)
                .sum();
    }

    private double shuntConsumptionMw(double[] magnitudes) {
        double total = 0.0;
        for (Shunt shunt : this.network.shunts()) {
            Optional<Integer> position = this.index.positionOf(shunt.bus());
            if (position.isPresent()) {
                double magnitude = magnitudes[position.get()];
                total += shunt.conductanceMw() * magnitude * magnitude;
            }
        }
        return total;
    }

    private List<BusResult> busResults(
            PowerFlowProblem problem,
            Injections injections,
            Map<Integer, ReactiveLimitState> converted,
            double[] magnitudes,
            double[] angles) {
        List<BusResult> results = new ArrayList<>();
        double baseMva = this.network.baseMva();
        for (Bus bus : this.network.buses()) {
            Optional<Integer> position = this.index.positionOf(bus.number());
            if (position.isEmpty()) {
                double[] loads = this.loadAt(bus.number());
                results.add(
                        new BusResult(
                                bus.number(),
                                BusType.ISOLATED,
                                BusState.DEENERGIZED,
                                0.0,
                                0.0,
                                0.0,
                                0.0,
                                loads[0],
                                loads[1]));
                continue;
            }
            int at = position.get();
            boolean hasGenerator = !this.model.generatorsAt(at).isEmpty();
            double activeGeneration = 0.0;
            double reactiveGeneration = 0.0;
            if (hasGenerator || problem.roles()[at] == BusType.REFERENCE) {
                activeGeneration = this.busActiveGeneration(problem, injections, at);
                reactiveGeneration = this.busReactiveGeneration(problem, injections, converted, at);
            }
            results.add(
                    new BusResult(
                            bus.number(),
                            problem.roles()[at],
                            BusState.ENERGIZED,
                            magnitudes[at],
                            Math.toDegrees(angles[at]),
                            activeGeneration * baseMva,
                            reactiveGeneration * baseMva,
                            this.model.loadActive(at) * baseMva,
                            this.model.loadReactive(at) * baseMva));
        }
        return results;
    }

    private double busActiveGeneration(PowerFlowProblem problem, Injections injections, int at) {
        if (problem.roles()[at] == BusType.REFERENCE) {
            return injections.activePower()[at] + this.model.loadActive(at);
        }
        return problem.activeSpecified()[at] + this.model.loadActive(at);
    }

    private double busReactiveGeneration(
            PowerFlowProblem problem,
            Injections injections,
            Map<Integer, ReactiveLimitState> converted,
            int at) {
        BusType role = problem.roles()[at];
        if (role == BusType.PQ) {
            return this.model.reactiveGeneration(at, converted);
        }
        return injections.reactivePower()[at] + this.model.loadReactive(at);
    }

    private List<GeneratorResult> generatorResults(
            PowerFlowProblem problem,
            Injections injections,
            Map<Integer, ReactiveLimitState> converted,
            List<String> warnings) {
        List<GeneratorResult> results = new ArrayList<>();
        for (Generator generator : this.network.generators()) {
            Optional<Integer> position = this.index.positionOf(generator.bus());
            if (!generator.inService() || position.isEmpty()) {
                results.add(
                        new GeneratorResult(
                                generator.id(),
                                generator.bus(),
                                generator.inService(),
                                0.0,
                                0.0,
                                ReactiveLimitState.NONE));
                continue;
            }
            int at = position.get();
            ReactiveLimitState limit = converted.getOrDefault(at, ReactiveLimitState.NONE);
            double active = this.generatorActive(problem, injections, at, generator);
            double reactive = this.generatorReactive(problem, injections, converted, at, generator);
            if (limit != ReactiveLimitState.NONE) {
                warnings.add(
                        String.format(
                                Locale.ROOT,
                                "Generator %s reached its %s reactive limit of %.1f MVAr, bus %d"
                                        + " is treated as a load bus",
                                generator.id(),
                                limit == ReactiveLimitState.UPPER ? "upper" : "lower",
                                reactive,
                                generator.bus()));
            }
            results.add(
                    new GeneratorResult(
                            generator.id(), generator.bus(), true, active, reactive, limit));
        }
        return results;
    }

    private double generatorActive(
            PowerFlowProblem problem, Injections injections, int at, Generator generator) {
        double baseMva = this.network.baseMva();
        List<Generator> atBus = this.model.generatorsAt(at);
        if (problem.roles()[at] != BusType.REFERENCE || atBus.get(0) != generator) {
            return generator.activePowerMw();
        }
        double others = atBus.stream().skip(1).mapToDouble(Generator::activePowerMw).sum();
        return (injections.activePower()[at] + this.model.loadActive(at)) * baseMva - others;
    }

    private double generatorReactive(
            PowerFlowProblem problem,
            Injections injections,
            Map<Integer, ReactiveLimitState> converted,
            int at,
            Generator generator) {
        double baseMva = this.network.baseMva();
        if (problem.roles()[at] == BusType.PQ) {
            return switch (converted.getOrDefault(at, ReactiveLimitState.NONE)) {
                case UPPER -> generator.reactiveMaxMvar();
                case LOWER -> generator.reactiveMinMvar();
                case NONE -> generator.reactivePowerMvar();
            };
        }
        double total = injections.reactivePower()[at] + this.model.loadReactive(at);
        double minimum = this.model.reactiveMin(at);
        double range = this.model.reactiveMax(at) - minimum;
        if (range <= 0.0) {
            return total * baseMva / this.model.generatorsAt(at).size();
        }
        double fraction = (total - minimum) / range;
        return generator.reactiveMinMvar()
                + fraction * (generator.reactiveMaxMvar() - generator.reactiveMinMvar());
    }

    private void addSlackWarning(
            List<GeneratorResult> generators, double slackActive, List<String> warnings) {
        int reference = this.network.referenceBus().number();
        this.network.generators().stream()
                .filter(generator -> generator.inService() && generator.bus() == reference)
                .findFirst()
                .ifPresent(
                        generator -> {
                            double others =
                                    generators.stream()
                                            .filter(
                                                    result ->
                                                            result.bus() == reference
                                                                    && !result.id()
                                                                            .equals(generator.id()))
                                            .mapToDouble(GeneratorResult::activeMw)
                                            .sum();
                            double output = slackActive - others;
                            if (output > generator.activeMaxMw() + 1e-6
                                    || output < generator.activeMinMw() - 1e-6) {
                                warnings.add(
                                        String.format(
                                                Locale.ROOT,
                                                "Slack generator %s produces %.1f MW, outside its"
                                                        + " range of %.1f to %.1f MW",
                                                generator.id(),
                                                output,
                                                generator.activeMinMw(),
                                                generator.activeMaxMw()));
                            }
                        });
    }

    private List<BranchResult> branchResults(double[] magnitudes, double[] angles) {
        return this.network.branches().stream()
                .map(branch -> this.branchResult(branch, magnitudes, angles))
                .toList();
    }

    private BranchResult branchResult(Branch branch, double[] magnitudes, double[] angles) {
        Optional<Integer> from = this.index.positionOf(branch.from());
        Optional<Integer> to = this.index.positionOf(branch.to());
        if (!branch.inService() || from.isEmpty() || to.isEmpty()) {
            return deadBranch(branch);
        }
        BranchAdmittances admittances = BranchAdmittances.of(branch);
        double fromReal = magnitudes[from.get()] * Math.cos(angles[from.get()]);
        double fromImaginary = magnitudes[from.get()] * Math.sin(angles[from.get()]);
        double toReal = magnitudes[to.get()] * Math.cos(angles[to.get()]);
        double toImaginary = magnitudes[to.get()] * Math.sin(angles[to.get()]);
        double[] fromCurrent =
                current(
                        admittances.fromFrom(),
                        fromReal,
                        fromImaginary,
                        admittances.fromTo(),
                        toReal,
                        toImaginary);
        double[] toCurrent =
                current(
                        admittances.toTo(),
                        toReal,
                        toImaginary,
                        admittances.toFrom(),
                        fromReal,
                        fromImaginary);
        double[] fromPower = power(fromReal, fromImaginary, fromCurrent);
        double[] toPower = power(toReal, toImaginary, toCurrent);
        double baseMva = this.network.baseMva();
        double fromApparent = Math.hypot(fromPower[0], fromPower[1]) * baseMva;
        double toApparent = Math.hypot(toPower[0], toPower[1]) * baseMva;
        return new BranchResult(
                branch.id(),
                branch.from(),
                branch.to(),
                true,
                fromPower[0] * baseMva,
                fromPower[1] * baseMva,
                toPower[0] * baseMva,
                toPower[1] * baseMva,
                this.kiloAmperes(fromCurrent, branch.from()),
                this.kiloAmperes(toCurrent, branch.to()),
                Math.max(fromApparent, toApparent) / branch.ratingMva(),
                (fromPower[0] + toPower[0]) * baseMva);
    }

    private double kiloAmperes(double[] current, int busNumber) {
        double baseKv = this.network.findBus(busNumber).orElseThrow().baseKv();
        return Math.hypot(current[0], current[1]) * this.network.baseMva() / (SQRT_THREE * baseKv);
    }

    private static double[] current(
            Admittance own,
            double ownReal,
            double ownImaginary,
            Admittance mutual,
            double otherReal,
            double otherImaginary) {
        double real =
                own.conductance() * ownReal
                        - own.susceptance() * ownImaginary
                        + mutual.conductance() * otherReal
                        - mutual.susceptance() * otherImaginary;
        double imaginary =
                own.conductance() * ownImaginary
                        + own.susceptance() * ownReal
                        + mutual.conductance() * otherImaginary
                        + mutual.susceptance() * otherReal;
        return new double[] {real, imaginary};
    }

    private static double[] power(double real, double imaginary, double[] current) {
        return new double[] {
            real * current[0] + imaginary * current[1], imaginary * current[0] - real * current[1]
        };
    }

    private static BranchResult deadBranch(Branch branch) {
        return new BranchResult(
                branch.id(), branch.from(), branch.to(), false, 0, 0, 0, 0, 0, 0, 0, 0);
    }
}
