package dev.gridtwin.cases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

import dev.gridtwin.domain.model.Branch;
import dev.gridtwin.domain.model.BusType;
import dev.gridtwin.domain.model.Generator;
import dev.gridtwin.domain.model.Network;
import dev.gridtwin.domain.model.Shunt;
import java.util.List;
import org.junit.jupiter.api.Test;

class CaseLoaderTest {

    private final Network ieee14 = CaseLoader.load("ieee14").network();
    private final Network ieee30 = CaseLoader.load("ieee30").network();

    @Test
    void listsTheAvailableCases() {
        assertThat(CaseLoader.availableIds()).containsExactly("ieee14", "ieee30");
    }

    @Test
    void ieee14HasTheExpectedSizes() {
        assertThat(this.ieee14.baseMva()).isEqualTo(100.0);
        assertThat(this.ieee14.buses()).hasSize(14);
        assertThat(this.ieee14.branches()).hasSize(20);
        assertThat(this.ieee14.generators()).hasSize(5);
        assertThat(this.ieee14.loads()).hasSize(11);
        assertThat(this.ieee14.totalLoadMw()).isCloseTo(259.0, within(1e-9));
    }

    @Test
    void ieee30HasTheExpectedSizes() {
        assertThat(this.ieee30.buses()).hasSize(30);
        assertThat(this.ieee30.branches()).hasSize(41);
        assertThat(this.ieee30.generators()).hasSize(6);
        assertThat(this.ieee30.loads()).hasSize(21);
        assertThat(this.ieee30.totalLoadMw()).isCloseTo(283.4, within(1e-9));
    }

    @Test
    void ieee14TransformerTapsAndTheBusNineShuntMatchTheSource() {
        assertThat(tapOf(this.ieee14, "T4-7")).isEqualTo(0.978);
        assertThat(tapOf(this.ieee14, "T4-9")).isEqualTo(0.969);
        assertThat(tapOf(this.ieee14, "T5-6")).isEqualTo(0.932);
        assertThat(this.ieee14.branches().stream().filter(Branch::isTransformer)).hasSize(3);
        assertThat(this.ieee14.shunts()).containsExactly(new Shunt(9, 0.0, 19.0));
    }

    @Test
    void ieee30HasFourTapChangingTransformers() {
        assertThat(this.ieee30.branches().stream().filter(Branch::isTransformer).map(Branch::tap))
                .containsExactlyInAnyOrder(0.978, 0.969, 0.932, 0.968);
        assertThat(this.ieee30.shunts())
                .containsExactly(new Shunt(10, 0.0, 19.0), new Shunt(24, 0.0, 4.3));
    }

    @Test
    void ieee14GeneratorLimitsAndSetpointsMatchTheSource() {
        Generator second = generator(this.ieee14, "G2");
        assertThat(second.bus()).isEqualTo(2);
        assertThat(second.reactiveMinMvar()).isEqualTo(-40.0);
        assertThat(second.reactiveMaxMvar()).isEqualTo(50.0);
        assertThat(second.voltageSetpoint()).isEqualTo(1.045);
        assertThat(generator(this.ieee14, "G1").reactiveMaxMvar()).isEqualTo(10.0);
        assertThat(this.ieee14.generators()).allMatch(Generator::inService);
    }

    @Test
    void theReferenceBusIsBusOneInBothCases() {
        assertThat(this.ieee14.referenceBus().number()).isEqualTo(1);
        assertThat(this.ieee30.referenceBus().number()).isEqualTo(1);
        assertThat(this.ieee14.findBus(2).orElseThrow().type()).isEqualTo(BusType.PV);
        assertThat(this.ieee14.findBus(4).orElseThrow().type()).isEqualTo(BusType.PQ);
    }

    @Test
    void voltageBandsComeFromTheSource() {
        assertThat(this.ieee14.findBus(1).orElseThrow().voltageMax()).isEqualTo(1.06);
        assertThat(this.ieee14.findBus(1).orElseThrow().voltageMin()).isEqualTo(0.94);
    }

    @Test
    void ieee14UsesTheSyntheticVoltageLevels() {
        assertThat(this.ieee14.buses().stream().filter(bus -> bus.number() <= 5))
                .allMatch(bus -> bus.baseKv() == 132.0);
        assertThat(this.ieee14.buses().stream().filter(bus -> bus.number() > 5))
                .allMatch(bus -> bus.baseKv() == 33.0);
    }

    @Test
    void ieee30CorrectsTheOneKilovoltBusNine() {
        assertThat(this.ieee30.findBus(9).orElseThrow().baseKv()).isEqualTo(33.0);
        assertThat(this.ieee30.findBus(11).orElseThrow().baseKv()).isEqualTo(11.0);
        assertThat(this.ieee30.findBus(1).orElseThrow().baseKv()).isEqualTo(132.0);
    }

    @Test
    void everyBranchHasASyntheticRatingOfAtLeastTwentyMva() {
        assertThat(this.ieee14.branches()).allMatch(branch -> branch.ratingMva() >= 20.0);
        assertThat(this.ieee30.branches()).allMatch(branch -> branch.ratingMva() >= 20.0);
        assertThat(this.ieee14.findBranch("L2-4").orElseThrow().ratingMva()).isEqualTo(75.0);
    }

    @Test
    void everyBusHasALayoutPosition() {
        CaseData data = CaseLoader.load("ieee30");
        assertThat(data.layout()).hasSize(30);
        assertThat(data.network().buses())
                .allSatisfy(bus -> assertThat(data.positionOf(bus.number())).isPresent());
        assertThat(data.positionOf(99)).isEmpty();
    }

    @Test
    void provenanceNamesTheSourceAndTheTools() {
        Provenance provenance = CaseLoader.load("ieee14").provenance();
        assertThat(provenance.matpowerVersion()).isEqualTo("8.1");
        assertThat(provenance.matpowerArchiveSha256()).hasSize(64);
        assertThat(provenance.source()).contains("case14").contains("University of Washington");
        assertThat(provenance.ratingPolicy()).contains("1.25");
        assertThat(provenance.generatedBy()).isEqualTo("tools/reference/export_case.m");
        assertThat(CaseLoader.load("ieee30").provenance().voltagePolicy()).contains("bus 9");
    }

    @Test
    void anUnknownCaseIsRefusedWithTheAvailableIds() {
        assertThatThrownBy(() -> CaseLoader.load("ieee57"))
                .isInstanceOf(CaseLoadException.class)
                .hasMessageContaining("ieee57")
                .hasMessageContaining(List.of("ieee14", "ieee30").toString());
    }

    private static double tapOf(Network network, String branchId) {
        return network.findBranch(branchId).orElseThrow().tap();
    }

    private static Generator generator(Network network, String id) {
        return network.generators().stream()
                .filter(generator -> generator.id().equals(id))
                .findFirst()
                .orElseThrow();
    }
}
