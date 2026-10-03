package dev.gridtwin.domain.powerflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import dev.gridtwin.domain.model.Branch;
import dev.gridtwin.domain.model.BusType;
import dev.gridtwin.domain.model.Network;
import dev.gridtwin.domain.model.Shunt;
import java.util.List;
import org.junit.jupiter.api.Test;

class YbusTest {

    private static final double TOLERANCE = 1e-12;

    private static final double LINE_A_REACTANCE = 0.2;
    private static final double LINE_A_CHARGING = 0.04;
    private static final double TRANSFORMER_REACTANCE = 0.25;
    private static final double TRANSFORMER_TAP = 2.0;
    private static final double TRANSFORMER_SHIFT_DEGREES = 30.0;
    private static final double LINE_C_RESISTANCE = 0.1;
    private static final double LINE_C_REACTANCE = 0.3;
    private static final double SHUNT_AT_BUS_THREE_MVAR = 10.0;

    private static final Admittance Y11 = new Admittance(1.0, -4.98 - 3.0);
    private static final Admittance Y12 = new Admittance(0.0, 5.0);
    private static final Admittance Y13 = new Admittance(-1.0, 3.0);
    private static final Admittance Y21 = new Admittance(0.0, 5.0);
    private static final Admittance Y22 = new Admittance(0.0, -4.98 - 1.0);
    private static final Admittance Y23 = new Admittance(-1.0, Math.sqrt(3.0));
    private static final Admittance Y31 = new Admittance(-1.0, 3.0);
    private static final Admittance Y32 = new Admittance(1.0, Math.sqrt(3.0));
    private static final Admittance Y33 = new Admittance(1.0, -4.0 - 3.0 + 0.1);

    private static Network handExample() {
        return new Network(
                "hand",
                100.0,
                List.of(
                        TestNetworks.bus(1, BusType.REFERENCE),
                        TestNetworks.bus(2, BusType.PQ),
                        TestNetworks.bus(3, BusType.PQ)),
                List.of(),
                List.of(new Shunt(3, 0.0, SHUNT_AT_BUS_THREE_MVAR)),
                List.of(),
                List.of(
                        new Branch(
                                "A",
                                1,
                                2,
                                0.0,
                                LINE_A_REACTANCE,
                                LINE_A_CHARGING,
                                100.0,
                                1.0,
                                0.0,
                                true),
                        new Branch(
                                "B",
                                2,
                                3,
                                0.0,
                                TRANSFORMER_REACTANCE,
                                0.0,
                                100.0,
                                TRANSFORMER_TAP,
                                TRANSFORMER_SHIFT_DEGREES,
                                true),
                        new Branch(
                                "C",
                                1,
                                3,
                                LINE_C_RESISTANCE,
                                LINE_C_REACTANCE,
                                0.0,
                                100.0,
                                1.0,
                                0.0,
                                true)));
    }

    private static void assertEntry(Ybus ybus, int row, int column, Admittance expected) {
        Admittance actual = ybus.at(row, column);
        assertThat(actual.conductance())
                .as("G(%d,%d)", row, column)
                .isCloseTo(expected.conductance(), within(TOLERANCE));
        assertThat(actual.susceptance())
                .as("B(%d,%d)", row, column)
                .isCloseTo(expected.susceptance(), within(TOLERANCE));
    }

    @Test
    void theThreeBusExampleWithATapAndAPhaseShiftMatchesTheHandCalculation() {
        Network network = handExample();
        Ybus ybus = Ybus.build(network, BusIndex.of(List.of(1, 2, 3)));

        assertEntry(ybus, 0, 0, Y11);
        assertEntry(ybus, 0, 1, Y12);
        assertEntry(ybus, 0, 2, Y13);
        assertEntry(ybus, 1, 0, Y21);
        assertEntry(ybus, 1, 1, Y22);
        assertEntry(ybus, 1, 2, Y23);
        assertEntry(ybus, 2, 0, Y31);
        assertEntry(ybus, 2, 1, Y32);
        assertEntry(ybus, 2, 2, Y33);
    }

    @Test
    void aPhaseShiftMakesTheMatrixAsymmetricInTheShiftedBranchOnly() {
        Ybus ybus = Ybus.build(handExample(), BusIndex.of(List.of(1, 2, 3)));

        assertThat(ybus.at(1, 2).conductance()).isNotEqualTo(ybus.at(2, 1).conductance());
        assertEntry(ybus, 0, 1, ybus.at(1, 0));
        assertEntry(ybus, 0, 2, ybus.at(2, 0));
    }

    @Test
    void aBranchOutOfServiceContributesNothing() {
        Network network = handExample();
        Branch lineC = network.findBranch("C").orElseThrow().withInService(false);
        Network without =
                network.withBranches(
                        List.of(
                                network.findBranch("A").orElseThrow(),
                                network.findBranch("B").orElseThrow(),
                                lineC));

        Ybus ybus = Ybus.build(without, BusIndex.of(List.of(1, 2, 3)));

        assertThat(ybus.at(0, 2)).isEqualTo(Admittance.ZERO);
        assertEntry(ybus, 0, 0, new Admittance(0.0, -4.98));
    }

    @Test
    void parallelBranchesAddUpAndTheConductanceOfAShuntIsDividedByTheBase() {
        Network network =
                new Network(
                        "parallel",
                        50.0,
                        List.of(
                                TestNetworks.bus(1, BusType.REFERENCE),
                                TestNetworks.bus(2, BusType.PQ)),
                        List.of(),
                        List.of(new Shunt(2, 5.0, 0.0)),
                        List.of(),
                        List.of(
                                TestNetworks.line("L-1", 1, 2, 0.0, 0.5),
                                TestNetworks.line("L-2", 1, 2, 0.0, 0.5)));

        Ybus ybus = Ybus.build(network, BusIndex.of(List.of(1, 2)));

        assertEntry(ybus, 0, 1, new Admittance(0.0, 4.0));
        assertEntry(ybus, 1, 1, new Admittance(0.1, -4.0));
    }

    @Test
    void branchesAndShuntsOutsideTheIndexAreLeftOut() {
        Ybus ybus = Ybus.build(handExample(), BusIndex.of(List.of(1, 2)));

        assertThat(ybus.size()).isEqualTo(2);
        assertEntry(ybus, 0, 0, new Admittance(0.0, -4.98));
        assertEntry(ybus, 1, 1, new Admittance(0.0, -4.98));
        assertThat(ybus.nonZeroCount()).isEqualTo(4);
    }

    @Test
    void injectionsOfAFlatProfileAreTheNegatedRowSumsOfTheMatrix() {
        Ybus ybus = Ybus.build(handExample(), BusIndex.of(List.of(1, 2, 3)));
        double[] flatMagnitudes = {1.0, 1.0, 1.0};
        double[] flatAngles = {0.0, 0.0, 0.0};
        double rowOneSusceptance = -7.98 + 5.0 + 3.0;
        double rowTwoSusceptance = 5.0 - 5.98 + Math.sqrt(3.0);
        double rowThreeSusceptance = 3.0 + Math.sqrt(3.0) - 6.9;

        Injections injections = ybus.injections(flatMagnitudes, flatAngles);

        assertThat(injections.activePower())
                .containsExactly(new double[] {0.0, -1.0, 1.0}, within(TOLERANCE));
        assertThat(injections.reactivePower())
                .containsExactly(
                        new double[] {-rowOneSusceptance, -rowTwoSusceptance, -rowThreeSusceptance},
                        within(TOLERANCE));
    }
}
