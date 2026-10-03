package dev.gridtwin.domain.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.gridtwin.domain.contingency.Outage;
import dev.gridtwin.domain.topology.Refusal;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class ValueTypesTest {

    @Test
    void randomSessionIdsAre128BitHexAndUnique() {
        SessionId first = SessionId.random();

        assertThat(first.value()).matches("[0-9a-f]{32}");
        assertThat(first).isNotEqualTo(SessionId.random());
        assertThat(first.toString()).isEqualTo(first.value());
    }

    @Test
    void aBlankSessionIdIsRejected() {
        assertThatThrownBy(() -> new SessionId(" ")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new SessionId(null)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void sessionLimitsMustBePositive() {
        assertThat(SessionLimits.standard().maxSessions()).isPositive();
        assertThatThrownBy(() -> new SessionLimits(0, Duration.ofMinutes(1)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new SessionLimits(1, Duration.ZERO))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new SessionLimits(1, Duration.ofMinutes(-1)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void everyFailureHasACodeAndAMessage() {
        List<TwinFailure> failures =
                List.of(
                        new TwinFailure.UnknownSession("s"),
                        new TwinFailure.UnknownCase("c"),
                        new TwinFailure.SessionLimitReached(2),
                        new TwinFailure.UnknownSwitch("x"),
                        new TwinFailure.OperationRefused(new Refusal.BreakerNotOpen("d", "b")),
                        new TwinFailure.InvalidInput("field", "reason"),
                        new TwinFailure.UnknownContingency("branch:x"),
                        new TwinFailure.NoContingencyResult(),
                        new TwinFailure.NoCascadeResult());

        assertThat(failures)
                .allSatisfy(
                        failure -> {
                            assertThat(failure.code()).matches("[A-Z_]+");
                            assertThat(failure.message()).isNotBlank();
                        });
        assertThat(failures.stream().map(TwinFailure::code).distinct()).hasSize(failures.size());
    }

    @Test
    void anUnknownSwitchRefusalBecomesAnUnknownSwitchFailure() {
        assertThat(TwinFailure.of(new Refusal.UnknownSwitch("x")))
                .isEqualTo(new TwinFailure.UnknownSwitch("x"));
        Refusal refusal = new Refusal.SectionEnergized("e", "BB1");
        assertThat(TwinFailure.of(refusal)).isEqualTo(new TwinFailure.OperationRefused(refusal));
    }

    @Test
    void theExceptionCarriesItsFailure() {
        TwinFailure failure = new TwinFailure.UnknownCase("c");
        TwinException exception = new TwinException(failure);

        assertThat(exception.failure()).isSameAs(failure);
        assertThat(exception).hasMessage(failure.message());
    }

    @Test
    void outageIdsParseBackToTheOutage() {
        assertThat(Outage.parse("branch:L1-2")).contains(Outage.branch("L1-2"));
        assertThat(Outage.parse("generator:G1")).contains(Outage.generator("G1"));
        assertThat(Outage.parse(Outage.branch("L9-9").id())).contains(Outage.branch("L9-9"));
        assertThat(Outage.parse("L1-2")).isEqualTo(Optional.empty());
    }

    @Test
    void theSystemTimeSourceReturnsAZonedTime() {
        assertThat(TimeSource.system().now()).isNotNull();
    }
}
