package dev.gridtwin.domain.topology;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.gridtwin.domain.model.Network;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class SubstationTest {

    private final Substation station = SmallStation.substation();

    private Substation with(
            List<Busbar> busbars, List<Node> nodes, List<Bay> bays, List<Switch> switches) {
        return new Substation(
                "s", "S", SmallStation.STATION_BUS, 132.0, busbars, nodes, bays, switches);
    }

    private List<Busbar> busbars() {
        return this.station.busbars();
    }

    private <T> List<T> plus(List<T> list, T extra) {
        List<T> copy = new ArrayList<>(list);
        copy.add(extra);
        return copy;
    }

    @Test
    void theFixtureHasFiveFeederBaysAndACouplerWithTheirSwitches() {
        assertThat(this.station.bays()).hasSize(6);
        assertThat(this.station.switches()).hasSize(5 * 5 + 5);
        assertThat(this.station.findSwitch("LA.QA1")).isPresent();
        assertThat(this.station.findSwitch("none")).isEmpty();
        assertThat(this.station.findBay("CPL").orElseThrow().kind()).isEqualTo(BayKind.COUPLER);
        assertThat(this.station.findBay("none")).isEmpty();
        assertThat(this.station.switchesOf("LA")).hasSize(5);
        assertThat(this.station.breakerOf("LA").id()).isEqualTo("LA.QA1");
    }

    @Test
    void initialPositionsFollowTheDeclaredDefaults() {
        SwitchPositions positions = this.station.initialPositions();

        assertThat(positions.isClosed("LA.QB1")).isTrue();
        assertThat(positions.isClosed("LA.QB2")).isFalse();
        assertThat(positions.of("LA.QE1")).isEqualTo(Position.OPEN);
    }

    @Test
    void switchPositionsAreImmutableAndRejectUnknownSwitches() {
        SwitchPositions positions = this.station.initialPositions();

        SwitchPositions changed = positions.with("LA.QA1", Position.OPEN);

        assertThat(positions.isClosed("LA.QA1")).isTrue();
        assertThat(changed.isClosed("LA.QA1")).isFalse();
        assertThatThrownBy(() -> positions.of("none")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> positions.byId().put("x", Position.OPEN))
                .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void duplicateNodesAreRejected() {
        List<Node> nodes = this.plus(this.station.nodes(), new Node("BB1"));

        assertThatThrownBy(
                        () ->
                                this.with(
                                        this.busbars(),
                                        nodes,
                                        this.station.bays(),
                                        this.station.switches()))
                .hasMessageContaining("duplicate node");
    }

    @Test
    void aSwitchToAnUnknownNodeIsRejected() {
        List<Switch> switches =
                this.plus(
                        this.station.switches(),
                        new Switch(
                                "LA.QX",
                                SwitchKind.DISCONNECTOR,
                                "LA",
                                "LA.A",
                                "ghost",
                                Position.OPEN));

        assertThatThrownBy(
                        () ->
                                this.with(
                                        this.busbars(),
                                        this.station.nodes(),
                                        this.station.bays(),
                                        switches))
                .hasMessageContaining("ghost");
    }

    @Test
    void aSwitchInAnUnknownBayIsRejected() {
        List<Switch> switches =
                this.plus(
                        this.station.switches(),
                        new Switch(
                                "ZZ.QB1",
                                SwitchKind.DISCONNECTOR,
                                "ZZ",
                                "LA.A",
                                "LA.B",
                                Position.OPEN));

        assertThatThrownBy(
                        () ->
                                this.with(
                                        this.busbars(),
                                        this.station.nodes(),
                                        this.station.bays(),
                                        switches))
                .hasMessageContaining("unknown bay ZZ");
    }

    @Test
    void aBayNeedsExactlyOneBreaker() {
        List<Switch> withoutBreaker =
                this.station.switches().stream()
                        .filter(candidate -> !candidate.id().equals("LA.QA1"))
                        .toList();
        List<Switch> twoBreakers =
                this.plus(
                        this.station.switches(),
                        new Switch(
                                "LA.QA2",
                                SwitchKind.BREAKER,
                                "LA",
                                "LA.A",
                                "LA.B",
                                Position.CLOSED));

        assertThatThrownBy(
                        () ->
                                this.with(
                                        this.busbars(),
                                        this.station.nodes(),
                                        this.station.bays(),
                                        withoutBreaker))
                .hasMessageContaining("exactly one breaker");
        assertThatThrownBy(
                        () ->
                                this.with(
                                        this.busbars(),
                                        this.station.nodes(),
                                        this.station.bays(),
                                        twoBreakers))
                .hasMessageContaining("exactly one breaker");
    }

    @Test
    void aTerminalAtAnUnknownNodeIsRejected() {
        List<Bay> bays =
                this.plus(
                        this.station.bays(),
                        new Bay(
                                "XX",
                                "X",
                                BayKind.FEEDER,
                                9,
                                Optional.of(new Terminal("ghost", TerminalKind.LOAD, ""))));

        assertThatThrownBy(
                        () ->
                                this.with(
                                        this.busbars(),
                                        this.station.nodes(),
                                        bays,
                                        this.station.switches()))
                .hasMessageContaining("ghost");
    }

    @Test
    void theLowestBusbarBusMustBeTheSubstationBus() {
        List<Busbar> busbars =
                List.of(new Busbar("BB1", 7, "Busbar 1", 0), new Busbar("BB2", 20, "Busbar 2", 1));

        assertThatThrownBy(
                        () ->
                                this.with(
                                        busbars,
                                        this.station.nodes(),
                                        this.station.bays(),
                                        this.station.switches()))
                .hasMessageContaining("lowest busbar");
    }

    @Test
    void busbarsNeedUniqueNodesAndNumbersAndAtLeastOneMustExist() {
        List<Busbar> sameNode =
                List.of(new Busbar("BB1", 2, "a", 0), new Busbar("BB1", 20, "b", 1));
        List<Busbar> sameNumber =
                List.of(new Busbar("BB1", 2, "a", 0), new Busbar("BB2", 2, "b", 1));

        assertThatThrownBy(
                        () ->
                                this.with(
                                        sameNode,
                                        this.station.nodes(),
                                        this.station.bays(),
                                        this.station.switches()))
                .hasMessageContaining("duplicate busbar node");
        assertThatThrownBy(
                        () ->
                                this.with(
                                        sameNumber,
                                        this.station.nodes(),
                                        this.station.bays(),
                                        this.station.switches()))
                .hasMessageContaining("duplicate busbar");
        assertThatThrownBy(
                        () ->
                                this.with(
                                        List.of(),
                                        this.station.nodes(),
                                        this.station.bays(),
                                        this.station.switches()))
                .hasMessageContaining("at least one busbar");
    }

    @Test
    void numbersAndVoltageMustBePositive() {
        assertThatThrownBy(
                        () ->
                                new Substation(
                                        "s",
                                        "S",
                                        0,
                                        132.0,
                                        this.busbars(),
                                        this.station.nodes(),
                                        this.station.bays(),
                                        this.station.switches()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(
                        () ->
                                new Substation(
                                        "s",
                                        "S",
                                        2,
                                        0.0,
                                        this.busbars(),
                                        this.station.nodes(),
                                        this.station.bays(),
                                        this.station.switches()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Busbar("BB", 0, "b", 0))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void switchAndBayRecordsRejectInconsistentDefinitions() {
        assertThatThrownBy(() -> new Switch(" ", SwitchKind.BREAKER, "b", "a", "c", Position.OPEN))
                .hasMessageContaining("blank");
        assertThatThrownBy(
                        () ->
                                new Switch(
                                        "e",
                                        SwitchKind.EARTHING_SWITCH,
                                        "b",
                                        "a",
                                        "c",
                                        Position.OPEN))
                .hasMessageContaining("must end at");
        assertThatThrownBy(
                        () ->
                                new Switch(
                                        "d",
                                        SwitchKind.DISCONNECTOR,
                                        "b",
                                        "a",
                                        Switch.EARTH,
                                        Position.OPEN))
                .hasMessageContaining("only an earthing switch");
        assertThatThrownBy(
                        () ->
                                new Switch(
                                        "d", SwitchKind.DISCONNECTOR, "b", "a", "a", Position.OPEN))
                .hasMessageContaining("itself");
        assertThatThrownBy(() -> new Node("")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(
                        () ->
                                new Bay(
                                        "c",
                                        "C",
                                        BayKind.COUPLER,
                                        0,
                                        Optional.of(new Terminal("n", TerminalKind.LOAD, ""))))
                .hasMessageContaining("no equipment terminal");
        assertThatThrownBy(() -> new Bay("f", "F", BayKind.FEEDER, 0, Optional.empty()))
                .hasMessageContaining("needs an equipment terminal");
        assertThat(
                        new Switch(
                                        "e",
                                        SwitchKind.EARTHING_SWITCH,
                                        "b",
                                        "a",
                                        Switch.EARTH,
                                        Position.OPEN)
                                .isEarthing())
                .isTrue();
    }

    @Test
    void islandAndNodeSetRecordsKeepTheirInvariants() {
        assertThatThrownBy(
                        () ->
                                new Island(
                                        "I1",
                                        List.of(1),
                                        Optional.of(new Slack(1, "G")),
                                        Optional.empty()))
                .hasMessageContaining("exactly when");
        NodeSet dead = new NodeSet("n", List.of("n"), Optional.of(3), true, false);
        NodeSet live = new NodeSet("m", List.of("m"), Optional.of(3), false, true);

        assertThat(dead.connectedBus()).isEmpty();
        assertThat(live.connectedBus()).contains(3);
        assertThat(new NodeSet("k", List.of("k"), Optional.empty(), false, false).state())
                .isEqualTo(NodeState.DEENERGIZED);
        assertThat(Map.of("x", live.state())).containsValue(NodeState.ENERGIZED);
    }

    @Test
    void theNetworkFixtureIsConsistent() {
        Network network = SmallStation.network();

        assertThat(network.buses()).hasSize(5);
        assertThat(network.referenceBus().number()).isEqualTo(1);
    }
}
