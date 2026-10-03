package dev.gridtwin.domain.topology;

import static org.assertj.core.api.Assertions.assertThat;

import dev.gridtwin.domain.topology.OperationResult.Accepted;
import dev.gridtwin.domain.topology.OperationResult.Refused;
import dev.gridtwin.domain.topology.Refusal.BreakerNotOpen;
import dev.gridtwin.domain.topology.Refusal.EarthedSectionWouldBeEnergized;
import dev.gridtwin.domain.topology.Refusal.SectionEnergized;
import dev.gridtwin.domain.topology.Refusal.UnknownSwitch;
import java.util.List;
import org.junit.jupiter.api.Test;

class InterlocksTest {

    private final Substation substation = SmallStation.substation();
    private final SwitchPositions initial = this.substation.initialPositions();

    private OperationResult check(SwitchPositions positions, String switchId, Position target) {
        Topology topology =
                TopologyProcessor.process(SmallStation.network(), this.substation, positions);
        return Interlocks.check(this.substation, topology, positions, switchId, target);
    }

    private Refusal refusal(OperationResult result) {
        assertThat(result).isInstanceOf(Refused.class);
        return ((Refused) result).refusal();
    }

    @Test
    void aDisconnectorCannotOpenWhileItsBayBreakerIsClosed() {
        OperationResult result = this.check(this.initial, "LA.QB1", Position.OPEN);

        Refusal refusal = this.refusal(result);
        assertThat(refusal).isEqualTo(new BreakerNotOpen("LA.QB1", "LA.QA1"));
        assertThat(refusal.code()).isEqualTo("BREAKER_CLOSED");
        assertThat(refusal.switchId()).isEqualTo("LA.QB1");
        assertThat(refusal.message()).contains("LA.QB1", "LA.QA1", "Open the breaker first");
        assertThat(result.accepted()).isFalse();
    }

    @Test
    void aDisconnectorCannotCloseWhileItsBayBreakerIsClosed() {
        OperationResult result = this.check(this.initial, "LA.QB2", Position.CLOSED);

        assertThat(this.refusal(result)).isInstanceOf(BreakerNotOpen.class);
    }

    @Test
    void theCouplerDisconnectorsFollowTheCouplerBreaker() {
        OperationResult result = this.check(this.initial, "CPL.QB1", Position.OPEN);

        assertThat(this.refusal(result)).isEqualTo(new BreakerNotOpen("CPL.QB1", "CPL.QA1"));
    }

    @Test
    void aDisconnectorOperatesWhileItsBreakerIsOpen() {
        SwitchPositions open = this.initial.with("LA.QA1", Position.OPEN);

        OperationResult result = this.check(open, "LA.QB2", Position.CLOSED);

        assertThat(result).isEqualTo(new Accepted("LA.QB2", Position.CLOSED, true));
        assertThat(result.accepted()).isTrue();
    }

    @Test
    void aBreakerAlwaysOpens() {
        assertThat(this.check(this.initial, "LA.QA1", Position.OPEN))
                .isEqualTo(new Accepted("LA.QA1", Position.OPEN, true));
        assertThat(this.check(this.initial, SmallStation.COUPLER_BREAKER, Position.OPEN).accepted())
                .isTrue();
    }

    @Test
    void anEarthingSwitchAlwaysOpens() {
        SwitchPositions earthed =
                this.initial.with("LD.QA1", Position.OPEN).with("LD.QE1", Position.CLOSED);

        assertThat(this.check(earthed, "LD.QE1", Position.OPEN))
                .isEqualTo(new Accepted("LD.QE1", Position.OPEN, true));
    }

    @Test
    void anEarthingSwitchIsRefusedOnALiveSection() {
        OperationResult result = this.check(this.initial, "LA.QE1", Position.CLOSED);

        Refusal refusal = this.refusal(result);
        assertThat(refusal).isInstanceOf(SectionEnergized.class);
        assertThat(refusal.code()).isEqualTo("SECTION_ENERGIZED");
        assertThat(refusal.message()).contains("LA.QE1", "energized");
    }

    @Test
    void anEarthingSwitchIsRefusedOnALineThatIsStillFedFromTheFarEnd() {
        SwitchPositions open = this.initial.with("LA.QA1", Position.OPEN);

        assertThat(this.refusal(this.check(open, "LA.QE1", Position.CLOSED)))
                .isInstanceOf(SectionEnergized.class);
    }

    @Test
    void anEarthingSwitchIsRefusedOnACouplerSectionThatTouchesALiveBusbar() {
        SwitchPositions open = this.initial.with(SmallStation.COUPLER_BREAKER, Position.OPEN);

        Refusal refusal = this.refusal(this.check(open, "CPL.QE1", Position.CLOSED));

        assertThat(refusal.message()).contains("Busbar 1");
    }

    @Test
    void anEarthingSwitchIsAcceptedOnADeadSection() {
        SwitchPositions open = this.initial.with("LD.QA1", Position.OPEN);

        assertThat(this.check(open, "LD.QE1", Position.CLOSED))
                .isEqualTo(new Accepted("LD.QE1", Position.CLOSED, true));
    }

    @Test
    void anEarthingSwitchIsAcceptedOnASectionWhoseOnlyEndIsADeadLine() {
        SwitchPositions open = this.initial.with("LB.QA1", Position.OPEN);

        assertThat(this.check(open, "LB.QE1", Position.CLOSED).accepted()).isTrue();
    }

    @Test
    void closingABreakerOntoAnEarthedSectionFromALiveSideIsRefused() {
        SwitchPositions earthed =
                this.initial.with("LD.QA1", Position.OPEN).with("LD.QE1", Position.CLOSED);

        Refusal refusal = this.refusal(this.check(earthed, "LD.QA1", Position.CLOSED));

        assertThat(refusal).isInstanceOf(EarthedSectionWouldBeEnergized.class);
        assertThat(refusal.code()).isEqualTo("EARTHED_SECTION_WOULD_BE_ENERGIZED");
        assertThat(refusal.message()).contains("LD.QA1", "earthed", "energized");
    }

    @Test
    void closingADisconnectorFromAnEarthedSectionOntoALiveBusbarIsRefused() {
        SwitchPositions earthed =
                this.initial
                        .with(SmallStation.COUPLER_BREAKER, Position.OPEN)
                        .with("CPL.QB2", Position.OPEN)
                        .with("CPL.QE2", Position.CLOSED);

        assertThat(this.refusal(this.check(earthed, "CPL.QB2", Position.CLOSED)))
                .isInstanceOf(EarthedSectionWouldBeEnergized.class);
    }

    @Test
    void closingOntoAnEarthedSectionIsAcceptedWhenTheOtherSideIsDead() {
        SwitchPositions earthed =
                this.initial
                        .with("LD.QA1", Position.OPEN)
                        .with("LD.QB9", Position.OPEN)
                        .with("LD.QE1", Position.CLOSED);

        assertThat(this.check(earthed, "LD.QB9", Position.CLOSED).accepted()).isTrue();
    }

    @Test
    void closingASwitchWithinOneSectionIsAccepted() {
        SwitchPositions open = this.initial.with("LA.QA1", Position.OPEN);

        assertThat(this.check(open, "LA.QB2", Position.CLOSED).accepted()).isTrue();
    }

    @Test
    void operatingASwitchThatAlreadyHasThePositionChangesNothing() {
        assertThat(this.check(this.initial, "LA.QA1", Position.CLOSED))
                .isEqualTo(new Accepted("LA.QA1", Position.CLOSED, false));
    }

    @Test
    void anUnknownSwitchIsRefused() {
        Refusal refusal = this.refusal(this.check(this.initial, "XX.QA1", Position.OPEN));

        assertThat(refusal).isEqualTo(new UnknownSwitch("XX.QA1"));
        assertThat(refusal.code()).isEqualTo("UNKNOWN_SWITCH");
        assertThat(refusal.message()).contains("XX.QA1");
    }

    @Test
    void everyRefusalHasACodeAndAReadableMessage() {
        List<Refusal> refusals =
                List.of(
                        new UnknownSwitch("a"),
                        new BreakerNotOpen("a", "b"),
                        new SectionEnergized("a", "c"),
                        new EarthedSectionWouldBeEnergized("a", "c", "d"));

        assertThat(refusals)
                .allSatisfy(
                        refusal -> {
                            assertThat(refusal.code()).matches("[A-Z_]+");
                            assertThat(refusal.message()).endsWith(".");
                            assertThat(refusal.switchId()).isEqualTo("a");
                        });
    }
}
