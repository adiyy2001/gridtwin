package dev.gridtwin.validation.property;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import dev.gridtwin.domain.model.Branch;
import dev.gridtwin.domain.model.Network;
import dev.gridtwin.domain.model.Shunt;
import dev.gridtwin.domain.powerflow.BranchResult;
import dev.gridtwin.domain.powerflow.BusResult;
import dev.gridtwin.domain.powerflow.EjmlSparseLuSolver;
import dev.gridtwin.domain.powerflow.PowerFlow;
import dev.gridtwin.domain.powerflow.PowerFlowOptions;
import dev.gridtwin.domain.powerflow.PowerFlowResult;
import java.util.List;
import java.util.Random;
import org.junit.jupiter.api.Test;

class PowerFlowPropertiesTest {

    private static final double BALANCE_TOLERANCE_MW = 1e-6 * 100.0;
    private static final double SOLUTION_TOLERANCE = 1e-7;

    private static PowerFlow withLimits(boolean enforce) {
        return new PowerFlow(
                PowerFlowOptions.standard().withReactiveLimits(enforce), EjmlSparseLuSolver::new);
    }

    private static PowerFlowResult solveOrDiscard(PowerFlow powerFlow, Network network) {
        PowerFlowResult result = powerFlow.solve(network);
        Discard.unless(result.converged(), "the random network has no solution");
        return result;
    }

    private static void assertGenerationEqualsLoadPlusLosses(PowerFlowResult result) {
        double dissipated =
                result.totalLoadMw() + result.totalLossMw() + result.shuntConsumptionMw();
        assertThat(result.totalGenerationMw()).isCloseTo(dissipated, within(BALANCE_TOLERANCE_MW));
    }

    @Test
    void generationEqualsLoadPlusLossesWithReactiveLimitsEnforced() {
        Property.forAll(
                        "generation equals load plus losses with limits",
                        RandomNetworks::generate,
                        network ->
                                assertGenerationEqualsLoadPlusLosses(
                                        solveOrDiscard(withLimits(true), network)))
                .run();
    }

    @Test
    void generationEqualsLoadPlusLossesWithoutReactiveLimits() {
        Property.forAll(
                        "generation equals load plus losses without limits",
                        RandomNetworks::generate,
                        network ->
                                assertGenerationEqualsLoadPlusLosses(
                                        solveOrDiscard(withLimits(false), network)))
                .run();
    }

    @Test
    void everyBusBalancesItsGenerationLoadShuntAndBranchFlows() {
        Property.forAll(
                        "bus balance",
                        RandomNetworks::generate,
                        network -> {
                            PowerFlowResult result = solveOrDiscard(withLimits(true), network);
                            for (BusResult bus : result.buses()) {
                                double leaving = flowsLeaving(result.branches(), bus.number());
                                double shunt = shuntLoss(network, bus);
                                assertThat(bus.activeGenerationMw() - bus.activeLoadMw())
                                        .as("bus %d", bus.number())
                                        .isCloseTo(leaving + shunt, within(BALANCE_TOLERANCE_MW));
                            }
                        })
                .run();
    }

    @Test
    void noPassiveBranchProducesActivePower() {
        Property.forAll(
                        "branch losses are not negative",
                        RandomNetworks::generate,
                        network -> {
                            PowerFlowResult result = solveOrDiscard(withLimits(true), network);
                            for (BranchResult branch : result.branches()) {
                                assertThat(branch.lossMw()).isGreaterThanOrEqualTo(-1e-9);
                            }
                        })
                .run();
    }

    @Test
    void aFlatStartAndAWarmStartFromAnotherLoadLevelReachTheSameSolution() {
        Property.forAll(
                        "flat equals warm",
                        random -> new double[] {random.nextDouble()},
                        factors -> {
                            Network network =
                                    RandomNetworks.generate(
                                            new Random(Double.doubleToLongBits(factors[0])));
                            PowerFlow powerFlow = withLimits(false);
                            PowerFlowResult flat = solveOrDiscard(powerFlow, network);
                            PowerFlowResult neighbour =
                                    solveOrDiscard(
                                            powerFlow,
                                            network.withLoadFactor(0.8 + 0.4 * factors[0]));

                            PowerFlowResult warm = powerFlow.solve(network, neighbour.warmStart());

                            assertThat(warm.converged()).isTrue();
                            assertSameSolution(flat, warm);
                        })
                .run();
    }

    @Test
    void takingABranchOutOfServiceAndBackReturnsTheOriginalSolution() {
        Property.forAll(
                        "outage and restoration",
                        RandomNetworks::generate,
                        network -> {
                            PowerFlow powerFlow = withLimits(false);
                            PowerFlowResult original = solveOrDiscard(powerFlow, network);
                            Branch removed = network.branches().get(network.branches().size() - 1);
                            Network without = replace(network, removed.withInService(false));
                            PowerFlowResult outage = solveOrDiscard(powerFlow, without);

                            PowerFlowResult restored = powerFlow.solve(network, outage.warmStart());

                            assertThat(restored.converged()).isTrue();
                            assertSameSolution(original, restored);
                        })
                .run();
    }

    private static Network replace(Network network, Branch replacement) {
        List<Branch> branches =
                network.branches().stream()
                        .map(branch -> branch.id().equals(replacement.id()) ? replacement : branch)
                        .toList();
        return network.withBranches(branches);
    }

    private static double flowsLeaving(List<BranchResult> branches, int busNumber) {
        double total = 0.0;
        for (BranchResult branch : branches) {
            if (branch.from() == busNumber) {
                total += branch.activeFromMw();
            }
            if (branch.to() == busNumber) {
                total += branch.activeToMw();
            }
        }
        return total;
    }

    private static double shuntLoss(Network network, BusResult bus) {
        return network.shunts().stream()
                        .filter(shunt -> shunt.bus() == bus.number())
                        .mapToDouble(Shunt::conductanceMw)
                        .sum()
                * bus.voltageMagnitude()
                * bus.voltageMagnitude();
    }

    private static void assertSameSolution(PowerFlowResult expected, PowerFlowResult actual) {
        for (BusResult bus : expected.buses()) {
            BusResult other = actual.bus(bus.number()).orElseThrow();
            assertThat(other.voltageMagnitude())
                    .as("voltage at bus %d", bus.number())
                    .isCloseTo(bus.voltageMagnitude(), within(SOLUTION_TOLERANCE));
            assertThat(other.angleDegrees())
                    .as("angle at bus %d", bus.number())
                    .isCloseTo(bus.angleDegrees(), within(SOLUTION_TOLERANCE * 100.0));
        }
    }
}
