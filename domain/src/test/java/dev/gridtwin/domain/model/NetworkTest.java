package dev.gridtwin.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class NetworkTest {

    private final Network network = ThreeBusNetwork.create();

    @Test
    void findsBusesAndBranchesByKey() {
        assertThat(this.network.findBus(2))
                .hasValueSatisfying(bus -> assertThat(bus.type()).isEqualTo(BusType.PQ));
        assertThat(this.network.findBus(9)).isEmpty();
        assertThat(this.network.findBranch("L2-3")).isPresent();
        assertThat(this.network.findBranch("L9-9")).isEmpty();
    }

    @Test
    void exposesTheReferenceBusAndTheTotalLoad() {
        assertThat(this.network.referenceBus().number()).isEqualTo(1);
        assertThat(this.network.totalLoadMw()).isEqualTo(150.0);
    }

    @Test
    void listsAreImmutableCopies() {
        List<Bus> buses = new ArrayList<>(ThreeBusNetwork.buses());
        Network built =
                ThreeBusNetwork.with(buses, List.of(ThreeBusNetwork.generator("G1", 1)), List.of());
        buses.clear();
        assertThat(built.buses()).hasSize(3);
        assertThatThrownBy(() -> built.buses().clear())
                .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void rejectsDuplicateBusNumbers() {
        List<Bus> buses =
                List.of(
                        new Bus(1, BusType.REFERENCE, 132.0, 0.95, 1.05, 1.0, 0.0),
                        new Bus(1, BusType.PQ, 132.0, 0.95, 1.05, 1.0, 0.0));
        assertThatThrownBy(() -> ThreeBusNetwork.with(buses, List.of(), List.of()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("duplicate bus number");
    }

    @Test
    void rejectsDuplicateBranchIds() {
        List<Branch> branches =
                List.of(ThreeBusNetwork.branch("L1-2", 1, 2), ThreeBusNetwork.branch("L1-2", 1, 3));
        assertThatThrownBy(() -> ThreeBusNetwork.with(ThreeBusNetwork.buses(), List.of(), branches))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("duplicate branch id");
    }

    @Test
    void rejectsBranchesGeneratorsAndLoadsOnUnknownBuses() {
        assertThatThrownBy(
                        () ->
                                ThreeBusNetwork.with(
                                        ThreeBusNetwork.buses(),
                                        List.of(),
                                        List.of(ThreeBusNetwork.branch("L1-7", 1, 7))))
                .hasMessageContaining("branch refers to unknown bus 7");
        assertThatThrownBy(
                        () ->
                                ThreeBusNetwork.with(
                                        ThreeBusNetwork.buses(),
                                        List.of(ThreeBusNetwork.generator("G7", 7)),
                                        List.of()))
                .hasMessageContaining("generator refers to unknown bus 7");
        assertThatThrownBy(
                        () ->
                                new Network(
                                        "x",
                                        100.0,
                                        ThreeBusNetwork.buses(),
                                        List.of(new Load(7, 1.0, 1.0)),
                                        List.of(),
                                        List.of(),
                                        List.of()))
                .hasMessageContaining("load refers to unknown bus 7");
    }

    @Test
    void needsExactlyOneReferenceBus() {
        List<Bus> none = List.of(new Bus(1, BusType.PQ, 132.0, 0.95, 1.05, 1.0, 0.0));
        assertThatThrownBy(() -> ThreeBusNetwork.with(none, List.of(), List.of()))
                .hasMessageContaining("exactly one reference bus");
    }

    @Test
    void rejectsANonPositiveBaseMva() {
        assertThatThrownBy(
                        () ->
                                new Network(
                                        "x",
                                        0.0,
                                        ThreeBusNetwork.buses(),
                                        List.of(),
                                        List.of(),
                                        List.of(),
                                        List.of()))
                .hasMessageContaining("base MVA");
    }
}
