package dev.gridtwin.domain.twin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.gridtwin.domain.model.Bus;
import dev.gridtwin.domain.model.BusType;
import dev.gridtwin.domain.model.Network;
import dev.gridtwin.domain.model.Shunt;
import dev.gridtwin.domain.topology.SmallStation;
import dev.gridtwin.domain.topology.SmallStation.BaySpec;
import dev.gridtwin.domain.topology.TerminalKind;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class GridModelTest {

    private final Network network = SmallStation.network();

    private Network withBuses(List<Bus> buses) {
        return new Network(
                "x",
                100.0,
                buses,
                this.network.loads(),
                this.network.shunts(),
                this.network.generators(),
                this.network.branches());
    }

    private List<BaySpec> baysWithout(String bayId) {
        return SmallStation.baySpecs().stream().filter(spec -> !spec.id().equals(bayId)).toList();
    }

    @Test
    void aMatchingNetworkAndSubstationFormAModelWithInitialState() {
        GridModel model = new GridModel(this.network, SmallStation.substation());

        TwinState state = model.initialState();

        assertThat(state.loadFactor()).isEqualTo(1.0);
        assertThat(state.positions()).isEqualTo(SmallStation.substation().initialPositions());
    }

    @Test
    void theSubstationBusMustExist() {
        List<Bus> buses = this.network.buses().stream().filter(bus -> bus.number() != 2).toList();
        Network withoutBus =
                new Network(
                        "x",
                        100.0,
                        buses,
                        List.of(),
                        List.of(),
                        this.network.generators().subList(0, 2),
                        List.of());

        assertThatThrownBy(() -> new GridModel(withoutBus, SmallStation.substation()))
                .hasMessageContaining("not in the network");
    }

    @Test
    void theSubstationMustNotSitOnTheReferenceBus() {
        List<Bus> buses =
                this.network.buses().stream()
                        .map(
                                bus ->
                                        bus.number() == 2
                                                ? bus.withType(BusType.REFERENCE)
                                                : bus.number() == 1
                                                        ? bus.withType(BusType.PQ)
                                                        : bus)
                        .toList();

        assertThatThrownBy(() -> new GridModel(this.withBuses(buses), SmallStation.substation()))
                .hasMessageContaining("reference bus");
    }

    @Test
    void theSecondBusbarNumberMustBeFree() {
        List<Bus> buses = new ArrayList<>(this.network.buses());
        buses.add(
                this.network.buses().get(2).renumbered(SmallStation.SECOND_BUSBAR_BUS, BusType.PQ));

        assertThatThrownBy(() -> new GridModel(this.withBuses(buses), SmallStation.substation()))
                .hasMessageContaining("already used");
    }

    @Test
    void shuntsAtTheSubstationBusAreNotSupported() {
        Network shunted =
                new Network(
                        "x",
                        100.0,
                        this.network.buses(),
                        this.network.loads(),
                        List.of(new Shunt(2, 0.0, 10.0)),
                        this.network.generators(),
                        this.network.branches());

        assertThatThrownBy(() -> new GridModel(shunted, SmallStation.substation()))
                .hasMessageContaining("shunts");
    }

    @Test
    void everyBranchGeneratorAndLoadAtTheBusNeedsATerminal() {
        assertThatThrownBy(
                        () ->
                                new GridModel(
                                        this.network,
                                        SmallStation.substation(this.baysWithout("LA"))))
                .hasMessageContaining("BRANCH");
        assertThatThrownBy(
                        () ->
                                new GridModel(
                                        this.network,
                                        SmallStation.substation(this.baysWithout("GS"))))
                .hasMessageContaining("GENERATOR");
        assertThatThrownBy(
                        () ->
                                new GridModel(
                                        this.network,
                                        SmallStation.substation(this.baysWithout("LD"))))
                .hasMessageContaining("load terminal");
    }

    @Test
    void anEquipmentIdMayHaveOnlyOneTerminal() {
        List<BaySpec> specs = new ArrayList<>(SmallStation.baySpecs());
        specs.add(new BaySpec("LE", TerminalKind.BRANCH, "L1-2", 1));

        assertThatThrownBy(() -> new GridModel(this.network, SmallStation.substation(specs)))
                .hasMessageContaining("more than one terminal");
    }

    @Test
    void twoLoadTerminalsAreRejected() {
        List<BaySpec> specs = new ArrayList<>(SmallStation.baySpecs());
        specs.add(new BaySpec("LE", TerminalKind.LOAD, "", 1));

        assertThatThrownBy(() -> new GridModel(this.network, SmallStation.substation(specs)))
                .hasMessageContaining("one load terminal");
    }
}
