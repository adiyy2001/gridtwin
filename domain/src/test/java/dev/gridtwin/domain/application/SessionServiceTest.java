package dev.gridtwin.domain.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

import dev.gridtwin.domain.cascade.CascadeResult;
import dev.gridtwin.domain.contingency.ContingencyAnalysis;
import dev.gridtwin.domain.contingency.ContingencyReport;
import dev.gridtwin.domain.contingency.ContingencyResult;
import dev.gridtwin.domain.topology.Position;
import dev.gridtwin.domain.topology.SmallStation;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ForkJoinPool;
import java.util.concurrent.Future;
import java.util.stream.IntStream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class SessionServiceTest {

    private static final String CASE_ID = SmallCatalog.ID;

    private final MutableClock clock = new MutableClock();
    private final InMemorySessions sessions = new InMemorySessions();
    private final RecordingPublisher publisher = new RecordingPublisher();
    private final ForkJoinPool pool = new ForkJoinPool(2);
    private final SessionLimits limits = new SessionLimits(3, Duration.ofMinutes(10));
    private final SessionService service =
            new SessionService(
                    this.clock,
                    this.sessions,
                    this.publisher,
                    new SmallCatalog(),
                    this.pool,
                    this.limits);

    @AfterEach
    void closePool() {
        this.pool.shutdown();
    }

    private TwinFailure failureOf(Runnable action) {
        return assertThrows(TwinException.class, action::run).failure();
    }

    private SessionId open() {
        return this.service.open(CASE_ID).id();
    }

    @Test
    void openingASessionSolvesTheCaseAndStartsAtVersionOne() {
        SessionService.Opened opened = this.service.open(CASE_ID);

        assertThat(opened.state().version()).isEqualTo(1);
        assertThat(opened.state().solution().converged()).isTrue();
        assertThat(opened.createdAt()).isEqualTo(this.clock.now());
        assertThat(this.service.sessionCount()).isEqualTo(1);
        assertThat(this.service.caseIds()).containsExactly(CASE_ID);
        assertThat(this.service.limits()).isEqualTo(this.limits);
    }

    @Test
    void anUnknownCaseIsRejected() {
        assertThat(this.failureOf(() -> this.service.open("nope")))
                .isEqualTo(new TwinFailure.UnknownCase("nope"));
    }

    @Test
    void sessionsGetDistinctIds() {
        assertThat(this.open()).isNotEqualTo(this.open());
    }

    @Test
    void theSessionCapRefusesTheNextOneAndIdleSessionsFreeTheirSlots() {
        SessionId first = this.open();
        this.open();
        this.open();

        assertThat(this.failureOf(this::open)).isEqualTo(new TwinFailure.SessionLimitReached(3));

        this.clock.advance(Duration.ofMinutes(11));
        SessionId fresh = this.open();

        assertThat(this.service.sessionCount()).isEqualTo(1);
        assertThat(this.publisher.closed()).hasSize(3).contains(first).doesNotContain(fresh);
    }

    @Test
    void touchingASessionKeepsItAlive() {
        SessionId active = this.open();
        this.clock.advance(Duration.ofMinutes(8));
        this.service.state(active);
        this.clock.advance(Duration.ofMinutes(8));

        assertThat(this.service.evictIdle()).isZero();
        assertThat(this.service.state(active).version()).isEqualTo(1);
    }

    @Test
    void operatingTheCouplerSplitsTheNetworkAndPublishesVersionTwo() {
        SessionId id = this.open();

        Versioned result = this.service.operate(id, SmallStation.COUPLER_BREAKER, Position.OPEN);

        assertThat(result.version()).isEqualTo(2);
        assertThat(result.solution().islands()).hasSize(2);
        assertThat(this.publisher.versions()).containsExactly(2L);
        assertThat(this.service.state(id).version()).isEqualTo(2);
    }

    @Test
    void aRefusedOperationKeepsTheVersionAndPublishesNothing() {
        SessionId id = this.open();

        TwinFailure failure =
                this.failureOf(() -> this.service.operate(id, "LA.QB1", Position.OPEN));

        assertThat(failure).isInstanceOf(TwinFailure.OperationRefused.class);
        assertThat(failure.code()).isEqualTo("BREAKER_CLOSED");
        assertThat(failure.message()).contains("LA.QB1").contains("LA.QA1");
        assertThat(this.service.state(id).version()).isEqualTo(1);
        assertThat(this.publisher.versions()).isEmpty();
    }

    @Test
    void anUnknownSwitchIsReportedAsUnknown() {
        SessionId id = this.open();

        assertThat(this.failureOf(() -> this.service.operate(id, "XX", Position.OPEN)))
                .isEqualTo(new TwinFailure.UnknownSwitch("XX"));
    }

    @Test
    void operatingASwitchIntoItsCurrentPositionChangesNothing() {
        SessionId id = this.open();

        Versioned result = this.service.operate(id, SmallStation.COUPLER_BREAKER, Position.CLOSED);

        assertThat(result.version()).isEqualTo(1);
        assertThat(this.publisher.versions()).isEmpty();
    }

    @Test
    void theLoadFactorChangesTheStateAndStaysInsideTheRange() {
        SessionId id = this.open();

        Versioned scaled = this.service.setLoadFactor(id, 1.2);
        Versioned same = this.service.setLoadFactor(id, 1.2);

        assertThat(scaled.version()).isEqualTo(2);
        assertThat(scaled.solution().state().loadFactor()).isEqualTo(1.2);
        assertThat(same.version()).isEqualTo(2);
        assertThat(this.publisher.versions()).containsExactly(2L);
        for (double invalid : new double[] {0.49, 1.51, Double.NaN, -1.0}) {
            assertThat(this.failureOf(() -> this.service.setLoadFactor(id, invalid)))
                    .isInstanceOf(TwinFailure.InvalidInput.class);
        }
        assertThat(this.service.state(id).version()).isEqualTo(2);
    }

    @Test
    void theContingencyRunRanksOutagesAndIsKeptForPreview() {
        SessionId id = this.open();

        AnalysisRecord<ContingencyReport> run = this.service.runContingencies(id);

        assertThat(run.version()).isEqualTo(1);
        assertThat(run.result().ranked()).isNotEmpty();
        assertThat(this.service.contingencies(id).result()).isSameAs(run.result());
        String first = run.result().ranked().get(0).id();
        AnalysisRecord<ContingencyResult> preview = this.service.preview(id, first);
        assertThat(preview.result().rank()).isEqualTo(1);
        assertThat(preview.state().loadFactor()).isEqualTo(1.0);
    }

    @Test
    void aPreviewNeedsAnExistingContingencyAndAFreshRun() {
        SessionId id = this.open();

        assertThat(this.failureOf(() -> this.service.contingencies(id)))
                .isInstanceOf(TwinFailure.NoContingencyResult.class);
        this.service.runContingencies(id);
        assertThat(this.failureOf(() -> this.service.preview(id, "branch:nope")))
                .isEqualTo(new TwinFailure.UnknownContingency("branch:nope"));
        this.service.setLoadFactor(id, 0.9);
        assertThat(this.failureOf(() -> this.service.preview(id, "branch:L1-2")))
                .isInstanceOf(TwinFailure.NoContingencyResult.class);
    }

    @Test
    void theCascadeRunsFromTheCurrentStateAndIsKept() {
        SessionId id = this.open();

        AnalysisRecord<CascadeResult> run =
                this.service.runCascade(id, "branch:L1-2", Optional.empty(), Optional.empty());

        assertThat(run.result().steps().get(0).tripped()).isEmpty();
        assertThat(run.result().steps().get(1).tripped()).isPresent();
        assertThat(this.service.cascade(id).result()).isSameAs(run.result());
        this.service.setLoadFactor(id, 0.9);
        assertThat(this.failureOf(() -> this.service.cascade(id)))
                .isInstanceOf(TwinFailure.NoCascadeResult.class);
    }

    @Test
    void theCascadeTakesGeneratorTriggersAndRejectsBadInput() {
        SessionId id = this.open();
        java.util.Optional<Double> none = Optional.empty();
        java.util.Optional<Integer> noSteps = Optional.empty();

        assertThat(this.service.runCascade(id, "generator:G4", none, noSteps).result().steps())
                .hasSizeGreaterThanOrEqualTo(2);
        for (String trigger : List.of("branch:nope", "generator:nope", "line", "")) {
            assertThat(this.failureOf(() -> this.service.runCascade(id, trigger, none, noSteps)))
                    .isInstanceOf(TwinFailure.InvalidInput.class);
        }
        assertThat(
                        this.failureOf(
                                () ->
                                        this.service.runCascade(
                                                id, "branch:L1-2", Optional.of(0.1), noSteps)))
                .isInstanceOf(TwinFailure.InvalidInput.class);
        assertThat(
                        this.failureOf(
                                () ->
                                        this.service.runCascade(
                                                id, "branch:L1-2", none, Optional.of(0))))
                .isInstanceOf(TwinFailure.InvalidInput.class);
        assertThat(
                        this.service
                                .runCascade(id, "branch:L1-2", Optional.of(1.5), Optional.of(5))
                                .result()
                                .tripThreshold())
                .isEqualTo(1.5);
    }

    @Test
    void closingASessionRemovesItAndTellsThePublisher() {
        SessionId id = this.open();

        this.service.close(id);

        assertThat(this.service.sessionCount()).isZero();
        assertThat(this.publisher.closed()).containsExactly(id);
        assertThat(this.failureOf(() -> this.service.state(id)))
                .isEqualTo(new TwinFailure.UnknownSession(id.value()));
    }

    @Test
    void everyCallOnAnUnknownSessionFailsTheSameWay() {
        SessionId id = new SessionId("missing");
        TwinFailure expected = new TwinFailure.UnknownSession("missing");
        java.util.Optional<Double> none = Optional.empty();
        java.util.Optional<Integer> noSteps = Optional.empty();

        List<Runnable> calls =
                List.of(
                        () -> this.service.state(id),
                        () -> this.service.operate(id, "X", Position.OPEN),
                        () -> this.service.setLoadFactor(id, 1.0),
                        () -> this.service.runContingencies(id),
                        () -> this.service.contingencies(id),
                        () -> this.service.preview(id, "branch:L1-2"),
                        () -> this.service.runCascade(id, "branch:L1-2", none, noSteps),
                        () -> this.service.cascade(id),
                        () -> this.service.close(id));
        calls.forEach(call -> assertThat(this.failureOf(call)).isEqualTo(expected));
    }

    @Test
    void parallelCommandsOnOneSessionProduceStrictlyIncreasingVersions() throws Exception {
        SessionId id = this.open();
        int commands = 24;
        try (ExecutorService executor = Executors.newFixedThreadPool(8)) {
            List<Future<Versioned>> futures =
                    IntStream.range(0, commands)
                            .mapToObj(
                                    index ->
                                            executor.submit(
                                                    () ->
                                                            this.service.setLoadFactor(
                                                                    id, 0.6 + index * 0.02)))
                            .toList();
            for (Future<Versioned> future : futures) {
                future.get();
            }
        }

        List<Long> versions = this.publisher.versions();
        assertThat(versions).hasSize(commands);
        assertThat(versions).isSorted();
        assertThat(versions).doesNotHaveDuplicates();
        assertThat(versions.get(commands - 1)).isEqualTo(commands + 1L);
    }

    @Test
    void aSessionThatIsAnalysedWhileChangingDropsTheStaleResult() {
        SessionId id = this.open();
        TwinSession session = this.sessions.find(id).orElseThrow();
        TwinSession.Snapshot before = session.snapshot();
        this.service.setLoadFactor(id, 1.1);

        boolean storedReport =
                session.storeReport(
                        before.version(),
                        ContingencyAnalysis.standard()
                                .run(before.twin().state(), before.twin().solution().grid()));

        assertThat(storedReport).isFalse();
        assertThat(session.report()).isEmpty();
        assertThat(session.storeCascade(before.version(), null)).isFalse();
    }
}
