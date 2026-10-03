package dev.gridtwin.domain.topology;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.gridtwin.domain.model.Branch;
import dev.gridtwin.domain.model.BusType;
import dev.gridtwin.domain.model.Generator;
import dev.gridtwin.domain.model.Network;
import java.util.List;
import org.junit.jupiter.api.Test;

class TopologyProcessorTest {

    private final Substation substation = SmallStation.substation();
    private final Network network = SmallStation.network();
    private final SwitchPositions initial = this.substation.initialPositions();

    private Topology process(SwitchPositions positions) {
        return TopologyProcessor.process(this.network, this.substation, positions);
    }

    private List<Integer> busNumbers(Topology topology) {
        return topology.network().buses().stream().map(bus -> bus.number()).toList();
    }

    private Island islandOf(Topology topology, int bus) {
        return topology.islandOf(bus).orElseThrow();
    }

    @Test
    void aClosedCouplerMergesBothBusbarsIntoOneElectricalBus() {
        Topology topology = this.process(this.initial);

        assertThat(topology.nodeSetOf("BB1").id()).isEqualTo(topology.nodeSetOf("BB2").id());
        assertThat(topology.nodeSetOf("BB1").busNumber()).contains(SmallStation.STATION_BUS);
        assertThat(this.busNumbers(topology)).containsExactly(1, 2, 3, 4, 5);
        assertThat(topology.islands()).hasSize(1);
        assertThat(topology.energizedIslands()).hasSize(1);
    }

    @Test
    void anOpenCouplerGivesTwoElectricalBusesAndMovesTheEquipmentToTheSecondOne() {
        Topology topology =
                this.process(this.initial.with(SmallStation.COUPLER_BREAKER, Position.OPEN));

        assertThat(topology.nodeSetOf("BB1").id()).isNotEqualTo(topology.nodeSetOf("BB2").id());
        assertThat(this.busNumbers(topology)).containsExactly(1, 2, 20, 3, 4, 5);
        Branch toBusFour = topology.network().findBranch("L2-4").orElseThrow();
        assertThat(toBusFour.from()).isEqualTo(SmallStation.SECOND_BUSBAR_BUS);
        assertThat(topology.network().loads())
                .anyMatch(
                        load ->
                                load.bus() == SmallStation.SECOND_BUSBAR_BUS
                                        && load.activePowerMw() == 20.0);
        assertThat(
                        topology.network().generators().stream()
                                .filter(generator -> generator.id().equals("GS"))
                                .findFirst()
                                .orElseThrow()
                                .bus())
                .isEqualTo(SmallStation.SECOND_BUSBAR_BUS);
    }

    @Test
    void anOpenCouplerSplitsTheNetworkIntoTwoEnergizedIslandsEachWithItsOwnSlack() {
        Topology topology =
                this.process(this.initial.with(SmallStation.COUPLER_BREAKER, Position.OPEN));

        assertThat(topology.islands()).hasSize(2);
        Island main = this.islandOf(topology, 1);
        Island split = this.islandOf(topology, 4);
        assertThat(main.buses()).containsExactly(1, 2, 3, 5);
        assertThat(main.slack()).contains(new Slack(1, "G1"));
        assertThat(split.buses()).containsExactly(4, 20);
        assertThat(split.slack()).contains(new Slack(4, "G4"));
        assertThat(split.network().orElseThrow().referenceBus().number()).isEqualTo(4);
    }

    @Test
    void theSlackOfAnIslandWithoutTheOriginalReferenceIsTheLargestUnitAndTiesGoToTheLowestBus() {
        List<Generator> equalUnits =
                this.network.generators().stream()
                        .map(
                                generator ->
                                        generator.id().equals("G1")
                                                ? generator
                                                : new Generator(
                                                        generator.id(),
                                                        generator.bus(),
                                                        generator.activePowerMw(),
                                                        0.0,
                                                        -30.0,
                                                        30.0,
                                                        0.0,
                                                        100.0,
                                                        1.01,
                                                        true))
                        .toList();
        Network equal =
                new Network(
                        "equal",
                        100.0,
                        this.network.buses(),
                        this.network.loads(),
                        this.network.shunts(),
                        equalUnits,
                        this.network.branches());

        Topology topology =
                TopologyProcessor.process(
                        equal,
                        this.substation,
                        this.initial.with(SmallStation.COUPLER_BREAKER, Position.OPEN));

        assertThat(this.islandOf(topology, 4).slack()).contains(new Slack(4, "G4"));
    }

    @Test
    void anIslandWithoutAnyUnitIsDeenergizedAndHasNoNetwork() {
        Topology topology = this.process(this.initial.with("LB.QA1", Position.OPEN));

        Island radial = this.islandOf(topology, 3);
        assertThat(radial.buses()).containsExactly(3, 5);
        assertThat(radial.energized()).isFalse();
        assertThat(radial.network()).isEmpty();
        assertThat(topology.network().findBranch("L2-3").orElseThrow().inService()).isFalse();
    }

    @Test
    void anIslandWhoseOnlyUnitCannotProducePowerIsDeenergized() {
        List<Generator> generators =
                this.network.generators().stream()
                        .map(
                                generator ->
                                        generator.id().equals("G4")
                                                ? new Generator(
                                                        "G4", 4, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0,
                                                        true)
                                                : generator)
                        .toList();
        Network weak =
                new Network(
                        "weak",
                        100.0,
                        this.network.buses(),
                        this.network.loads(),
                        this.network.shunts(),
                        generators,
                        this.network.branches());

        Topology topology =
                TopologyProcessor.process(
                        weak, this.substation, this.initial.with("LC.QA1", Position.OPEN));

        assertThat(topology.islandOf(4).orElseThrow().energized()).isFalse();
    }

    @Test
    void aGeneratorThatIsOutOfServiceDoesNotEnergizeItsIsland() {
        List<Generator> generators =
                this.network.generators().stream()
                        .map(
                                generator ->
                                        generator.id().equals("G4")
                                                ? generator.withInService(false)
                                                : generator)
                        .toList();
        Network stopped =
                new Network(
                        "stopped",
                        100.0,
                        this.network.buses(),
                        this.network.loads(),
                        this.network.shunts(),
                        generators,
                        this.network.branches());

        Topology topology =
                TopologyProcessor.process(
                        stopped, this.substation, this.initial.with("LC.QA1", Position.OPEN));

        assertThat(topology.islandOf(4).orElseThrow().energized()).isFalse();
    }

    @Test
    void anEarthedBusbarSectionIsExcludedFromEveryIsland() {
        SwitchPositions earthed = this.initial.with("CPL.QE1", Position.CLOSED);

        Topology topology = this.process(earthed);

        assertThat(topology.nodeSetOf("BB1").earthed()).isTrue();
        assertThat(topology.nodeSetOf("BB1").state()).isEqualTo(NodeState.EARTHED);
        assertThat(topology.nodeSetOf("BB1").connectedBus()).isEmpty();
        Island dead = this.islandOf(topology, SmallStation.STATION_BUS);
        assertThat(dead.buses()).containsExactly(SmallStation.STATION_BUS);
        assertThat(dead.energized()).isFalse();
        assertThat(topology.network().branches().stream().filter(Branch::inService).map(Branch::id))
                .containsExactly("L3-5");
        assertThat(topology.disconnectedLoadMw()).isEqualTo(20.0);
        assertThat(
                        topology.network().generators().stream()
                                .filter(generator -> generator.id().equals("GS"))
                                .findFirst()
                                .orElseThrow()
                                .inService())
                .isFalse();
    }

    @Test
    void aClosedEarthingSwitchOnADeadFeederSectionDoesNotTouchTheRestOfTheNetwork() {
        SwitchPositions positions =
                this.initial.with("LD.QA1", Position.OPEN).with("LD.QE1", Position.CLOSED);

        Topology topology = this.process(positions);

        assertThat(topology.nodeSetOf("LD.T").state()).isEqualTo(NodeState.EARTHED);
        assertThat(topology.nodeSetOf("BB1").state()).isEqualTo(NodeState.ENERGIZED);
        assertThat(topology.disconnectedLoadMw()).isEqualTo(20.0);
        assertThat(topology.islands()).hasSize(1);
    }

    @Test
    void aLoadWhoseBayIsIsolatedIsReportedAsDisconnectedAndLeftOutOfTheNetwork() {
        Topology topology = this.process(this.initial.with("LD.QB2", Position.OPEN));

        assertThat(topology.disconnectedLoads()).hasSize(1);
        assertThat(topology.disconnectedLoadMw()).isEqualTo(20.0);
        assertThat(topology.network().loads())
                .noneMatch(load -> load.bus() == SmallStation.STATION_BUS);
    }

    @Test
    void aGeneratorWhoseBayIsIsolatedIsTakenOutOfService() {
        Topology topology = this.process(this.initial.with("GS.QB9", Position.OPEN));

        Generator station =
                topology.network().generators().stream()
                        .filter(generator -> generator.id().equals("GS"))
                        .findFirst()
                        .orElseThrow();
        assertThat(station.inService()).isFalse();
        assertThat(station.bus()).isEqualTo(SmallStation.STATION_BUS);
    }

    @Test
    void aBayConnectedToBothBusbarsKeepsTheBusbarsMergedWithTheCouplerOpen() {
        SwitchPositions positions =
                this.initial
                        .with(SmallStation.COUPLER_BREAKER, Position.OPEN)
                        .with("LA.QB2", Position.CLOSED);

        Topology topology = this.process(positions);

        assertThat(topology.nodeSetOf("BB1").id()).isEqualTo(topology.nodeSetOf("BB2").id());
        assertThat(this.busNumbers(topology)).containsExactly(1, 2, 3, 4, 5);
    }

    @Test
    void sectionsAreEnergizedWhenAnEnergizedBusIsConnectedAndWhenAnEnergizedLineFeedsThem() {
        SwitchPositions positions = this.initial.with("LA.QA1", Position.OPEN);

        Topology topology = this.process(positions);

        assertThat(topology.stateOf("LA.A")).isEqualTo(NodeState.ENERGIZED);
        assertThat(topology.stateOf("LA.T")).isEqualTo(NodeState.ENERGIZED);
        assertThat(topology.nodeSetOf("LA.T").connectedBus()).isEmpty();
    }

    @Test
    void aLineSectionWhoseFarEndIsDeadIsDeenergizedWhenItsBreakerIsOpen() {
        SwitchPositions positions = this.initial.with("LB.QA1", Position.OPEN);

        Topology topology = this.process(positions);

        assertThat(topology.stateOf("LB.T")).isEqualTo(NodeState.DEENERGIZED);
        assertThat(topology.stateOf("LB.A")).isEqualTo(NodeState.ENERGIZED);
    }

    @Test
    void aGeneratorSectionIsEnergizedWhileTheUnitCanRun() {
        SwitchPositions positions = this.initial.with("GS.QA1", Position.OPEN);

        Topology topology = this.process(positions);

        assertThat(topology.stateOf("GS.T")).isEqualTo(NodeState.ENERGIZED);
    }

    @Test
    void aLoadSectionWithTheBreakerOpenIsDeenergized() {
        Topology topology = this.process(this.initial.with("LD.QA1", Position.OPEN));

        assertThat(topology.stateOf("LD.T")).isEqualTo(NodeState.DEENERGIZED);
    }

    @Test
    void anUnknownNodeIsReported() {
        Topology topology = this.process(this.initial);

        assertThatThrownBy(() -> topology.nodeSetOf("nowhere"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("nowhere");
    }

    @Test
    void islandsAreNumberedByTheirLowestBusAndTheirBusesAreSorted() {
        Topology topology =
                this.process(this.initial.with(SmallStation.COUPLER_BREAKER, Position.OPEN));

        assertThat(topology.islands()).extracting(Island::id).containsExactly("I1", "I2");
        assertThat(topology.islands().get(0).buses()).isSorted();
    }

    @Test
    void theSubNetworkOfAnIslandHoldsOnlyItsOwnEquipmentAndTypesTheBuses() {
        Topology topology =
                this.process(this.initial.with(SmallStation.COUPLER_BREAKER, Position.OPEN));

        Network split = this.islandOf(topology, 4).network().orElseThrow();

        assertThat(split.buses()).extracting(bus -> bus.number()).containsExactlyInAnyOrder(4, 20);
        assertThat(split.branches()).extracting(Branch::id).containsExactly("L2-4");
        assertThat(split.generators()).extracting(Generator::id).containsExactly("G4", "GS");
        assertThat(split.loads()).hasSize(1);
        assertThat(split.findBus(4).orElseThrow().type()).isEqualTo(BusType.REFERENCE);
        assertThat(split.findBus(20).orElseThrow().type()).isEqualTo(BusType.PV);
    }
}
