package dev.gridtwin.domain.application;

import dev.gridtwin.domain.cascade.CascadeOptions;
import dev.gridtwin.domain.cascade.CascadeResult;
import dev.gridtwin.domain.cascade.CascadeSimulation;
import dev.gridtwin.domain.contingency.ContingencyAnalysis;
import dev.gridtwin.domain.contingency.ContingencyOptions;
import dev.gridtwin.domain.contingency.ContingencyReport;
import dev.gridtwin.domain.contingency.ContingencyResult;
import dev.gridtwin.domain.contingency.Outage;
import dev.gridtwin.domain.topology.Position;
import dev.gridtwin.domain.twin.GridModel;
import dev.gridtwin.domain.twin.Twin;
import dev.gridtwin.domain.twin.TwinSolver;
import dev.gridtwin.domain.twin.TwinState;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ForkJoinPool;

public final class SessionService {

    private static final double MIN_TRIP_THRESHOLD = 0.5;
    private static final double MAX_TRIP_THRESHOLD = 3.0;
    private static final int MAX_CASCADE_STEPS = 100;

    private final TimeSource time;
    private final SessionRepository sessions;
    private final StatePublisher publisher;
    private final ModelCatalog catalog;
    private final ForkJoinPool pool;
    private final SessionLimits limits;
    private final TwinSolver solver;
    private final ContingencyAnalysis contingencies;
    private final CascadeOptions cascadeDefaults;
    private final Object creation = new Object();

    public SessionService(
            TimeSource time,
            SessionRepository sessions,
            StatePublisher publisher,
            ModelCatalog catalog,
            ForkJoinPool pool,
            SessionLimits limits) {
        this.time = time;
        this.sessions = sessions;
        this.publisher = publisher;
        this.catalog = catalog;
        this.pool = pool;
        this.limits = limits;
        this.solver = TwinSolver.standard();
        this.contingencies = new ContingencyAnalysis(this.solver, ContingencyOptions.standard());
        this.cascadeDefaults = CascadeOptions.standard();
    }

    public List<String> caseIds() {
        return this.catalog.ids();
    }

    public Opened open(String caseId) {
        GridModel model =
                this.catalog
                        .find(caseId)
                        .orElseThrow(() -> new TwinException(new TwinFailure.UnknownCase(caseId)));
        synchronized (this.creation) {
            ZonedDateTime now = this.now();
            this.evictIdle();
            if (this.sessions.count() >= this.limits.maxSessions()) {
                throw new TwinException(
                        new TwinFailure.SessionLimitReached(this.limits.maxSessions()));
            }
            TwinSession session =
                    TwinSession.open(SessionId.random(), Twin.start(this.solver, model), now);
            this.sessions.save(session);
            return new Opened(session.id(), session.createdAt(), session.snapshot().versioned());
        }
    }

    public Versioned state(SessionId id) {
        TwinSession session = this.require(id);
        session.touch(this.now());
        return session.snapshot().versioned();
    }

    public Versioned operate(SessionId id, String switchId, Position target) {
        return this.require(id).operate(switchId, target, this.publisher, this.now());
    }

    public Versioned setLoadFactor(SessionId id, double factor) {
        if (!(factor >= TwinState.MIN_LOAD_FACTOR && factor <= TwinState.MAX_LOAD_FACTOR)) {
            throw new TwinException(
                    new TwinFailure.InvalidInput(
                            "loadFactor",
                            "must be between "
                                    + TwinState.MIN_LOAD_FACTOR
                                    + " and "
                                    + TwinState.MAX_LOAD_FACTOR));
        }
        return this.require(id).scaleLoad(factor, this.publisher, this.now());
    }

    public AnalysisRecord<ContingencyReport> runContingencies(SessionId id) {
        TwinSession session = this.require(id);
        session.touch(this.now());
        TwinSession.Snapshot snapshot = session.snapshot();
        ContingencyReport report =
                this.contingencies.run(
                        snapshot.twin().state(), snapshot.twin().solution().grid(), this.pool);
        session.storeReport(snapshot.version(), report);
        return new AnalysisRecord<>(snapshot.version(), snapshot.twin().state(), report);
    }

    public AnalysisRecord<ContingencyReport> contingencies(SessionId id) {
        TwinSession session = this.require(id);
        session.touch(this.now());
        return session.report()
                .orElseThrow(() -> new TwinException(new TwinFailure.NoContingencyResult()));
    }

    public AnalysisRecord<ContingencyResult> preview(SessionId id, String contingencyId) {
        AnalysisRecord<ContingencyReport> stored = this.contingencies(id);
        ContingencyResult result =
                stored.result()
                        .find(contingencyId)
                        .orElseThrow(
                                () ->
                                        new TwinException(
                                                new TwinFailure.UnknownContingency(contingencyId)));
        return new AnalysisRecord<>(stored.version(), stored.state(), result);
    }

    public AnalysisRecord<CascadeResult> runCascade(
            SessionId id,
            String triggerId,
            Optional<Double> tripThreshold,
            Optional<Integer> maxSteps) {
        TwinSession session = this.require(id);
        session.touch(this.now());
        CascadeOptions options = this.cascadeOptions(tripThreshold, maxSteps);
        TwinSession.Snapshot snapshot = session.snapshot();
        Outage trigger = this.resolveTrigger(snapshot, triggerId);
        CascadeResult result =
                new CascadeSimulation(this.solver, options)
                        .run(snapshot.twin().state(), snapshot.twin().solution().grid(), trigger);
        session.storeCascade(snapshot.version(), result);
        return new AnalysisRecord<>(snapshot.version(), snapshot.twin().state(), result);
    }

    public AnalysisRecord<CascadeResult> cascade(SessionId id) {
        TwinSession session = this.require(id);
        session.touch(this.now());
        return session.cascade()
                .orElseThrow(() -> new TwinException(new TwinFailure.NoCascadeResult()));
    }

    public void close(SessionId id) {
        this.require(id);
        this.sessions.remove(id);
        this.publisher.sessionClosed(id);
    }

    public int evictIdle() {
        ZonedDateTime cutoff = this.now().minus(this.limits.idleTimeToLive());
        List<TwinSession> idle =
                this.sessions.all().stream().filter(session -> session.idleSince(cutoff)).toList();
        idle.stream()
                .filter(session -> this.sessions.remove(session.id()))
                .forEach(session -> this.publisher.sessionClosed(session.id()));
        return idle.size();
    }

    public int sessionCount() {
        return this.sessions.count();
    }

    public SessionLimits limits() {
        return this.limits;
    }

    private TwinSession require(SessionId id) {
        return this.sessions
                .find(id)
                .orElseThrow(() -> new TwinException(new TwinFailure.UnknownSession(id.value())));
    }

    private ZonedDateTime now() {
        return this.time.now();
    }

    private CascadeOptions cascadeOptions(
            Optional<Double> tripThreshold, Optional<Integer> maxSteps) {
        double threshold = tripThreshold.orElse(this.cascadeDefaults.tripThreshold());
        int steps = maxSteps.orElse(this.cascadeDefaults.maxSteps());
        if (!(threshold >= MIN_TRIP_THRESHOLD && threshold <= MAX_TRIP_THRESHOLD)) {
            throw new TwinException(
                    new TwinFailure.InvalidInput(
                            "tripThreshold",
                            "must be between "
                                    + MIN_TRIP_THRESHOLD
                                    + " and "
                                    + MAX_TRIP_THRESHOLD));
        }
        if (steps < 1 || steps > MAX_CASCADE_STEPS) {
            throw new TwinException(
                    new TwinFailure.InvalidInput(
                            "maxSteps", "must be between 1 and " + MAX_CASCADE_STEPS));
        }
        return new CascadeOptions(threshold, steps);
    }

    private Outage resolveTrigger(TwinSession.Snapshot snapshot, String triggerId) {
        return Outage.parse(triggerId)
                .filter(
                        candidate ->
                                this.contingencies
                                        .outagesOf(snapshot.twin().solution().topology())
                                        .contains(candidate))
                .orElseThrow(
                        () ->
                                new TwinException(
                                        new TwinFailure.InvalidInput(
                                                "trigger",
                                                "unknown outage "
                                                        + triggerId
                                                        + ", use branch:<id> or"
                                                        + " generator:<id> of equipment"
                                                        + " in service")));
    }

    public record Opened(SessionId id, ZonedDateTime createdAt, Versioned state) {}
}
