package dev.gridtwin.domain.contingency;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.gridtwin.domain.model.Branch;
import dev.gridtwin.domain.model.Generator;
import dev.gridtwin.domain.model.Network;
import dev.gridtwin.domain.topology.NetworkTopology;
import dev.gridtwin.domain.topology.Outages;
import dev.gridtwin.domain.topology.Topology;
import org.junit.jupiter.api.Test;

class OutagesTest {

    private final Network network = ContingencyNetworks.meshWithSpur(30.0, 50.0);

    @Test
    void noneIsEmptyAndLeavesTheNetworkAlone() {
        Outages none = Outages.none();

        assertThat(none.isEmpty()).isTrue();
        assertThat(none.size()).isZero();
        assertThat(none.applyTo(this.network)).isEqualTo(this.network);
    }

    @Test
    void outagesAccumulateWithoutChangingTheOriginal() {
        Outages first = Outages.none().withBranch("L1-2");
        Outages both = first.withGenerator("G2").withBranch("L2-3");

        assertThat(first.size()).isEqualTo(1);
        assertThat(both.branchIds()).containsExactly("L1-2", "L2-3");
        assertThat(both.generatorIds()).containsExactly("G2");
        assertThat(both.isEmpty()).isFalse();
    }

    @Test
    void applyingOutagesTakesTheEquipmentOutOfService() {
        Network affected =
                Outages.none().withBranch("L2-3").withGenerator("G2").applyTo(this.network);

        assertThat(affected.findBranch("L2-3").orElseThrow().inService()).isFalse();
        assertThat(affected.findBranch("L1-2").orElseThrow().inService()).isTrue();
        assertThat(affected.generators().stream().filter(Generator::inService).map(Generator::id))
                .containsExactly("G1", "G6");
        assertThat(this.network.branches()).allMatch(Branch::inService);
    }

    @Test
    void unknownEquipmentIsRejected() {
        assertThatThrownBy(() -> Outages.none().withBranch("L9-9").applyTo(this.network))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("L9-9");
        assertThatThrownBy(() -> Outages.none().withGenerator("G9").applyTo(this.network))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("G9");
    }

    @Test
    void aNetworkTopologyBuildsIslandsAroundTheOutage() {
        NetworkTopology source = new NetworkTopology(this.network);

        Topology intact = source.topology();
        Topology split = source.topology(Outages.none().withBranch("L4-5"));

        assertThat(intact.islands()).hasSize(1);
        assertThat(split.islands()).hasSize(2);
        assertThat(split.islandOf(6).orElseThrow().slack().orElseThrow().generatorId())
                .isEqualTo("G6");
        assertThat(split.islandOf(1).orElseThrow().contains(4)).isTrue();
    }

    @Test
    void outageIdsNameTheKindAndTheEquipment() {
        assertThat(Outage.branch("L1-2").id()).isEqualTo("branch:L1-2");
        assertThat(Outage.generator("G2").id()).isEqualTo("generator:G2");
        assertThat(Outage.generator("G2").equipmentId()).isEqualTo("G2");
        assertThat(Outage.branch("L1-2").addTo(Outages.none()).branchIds()).containsExactly("L1-2");
        assertThat(Outage.generator("G2").addTo(Outages.none()).generatorIds())
                .containsExactly("G2");
    }
}
