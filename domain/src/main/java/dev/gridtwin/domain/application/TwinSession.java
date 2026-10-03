package dev.gridtwin.domain.application;

import dev.gridtwin.domain.cascade.CascadeResult;
import dev.gridtwin.domain.contingency.ContingencyReport;
import dev.gridtwin.domain.topology.OperationResult;
import dev.gridtwin.domain.topology.Position;
import dev.gridtwin.domain.twin.Twin;
import java.time.ZonedDateTime;
import java.util.Optional;
import java.util.concurrent.locks.ReentrantLock;

public final class TwinSession {

    private final SessionId id;
    private final ZonedDateTime createdAt;
    private final ReentrantLock lock = new ReentrantLock();
    private Twin twin;
    private long version;
    private Optional<AnalysisRecord<ContingencyReport>> report = Optional.empty();
    private Optional<AnalysisRecord<CascadeResult>> cascade = Optional.empty();
    private volatile ZonedDateTime lastUsedAt;

    private TwinSession(SessionId id, Twin twin, ZonedDateTime now) {
        this.id = id;
        this.twin = twin;
        this.version = 1;
        this.createdAt = now;
        this.lastUsedAt = now;
    }

    public static TwinSession open(SessionId id, Twin twin, ZonedDateTime now) {
        return new TwinSession(id, twin, now);
    }

    public SessionId id() {
        return this.id;
    }

    public ZonedDateTime createdAt() {
        return this.createdAt;
    }

    public ZonedDateTime lastUsedAt() {
        return this.lastUsedAt;
    }

    public void touch(ZonedDateTime now) {
        this.lastUsedAt = now;
    }

    public boolean idleSince(ZonedDateTime cutoff) {
        return this.lastUsedAt.isBefore(cutoff);
    }

    public Snapshot snapshot() {
        this.lock.lock();
        try {
            return new Snapshot(this.version, this.twin);
        } finally {
            this.lock.unlock();
        }
    }

    public Versioned operate(
            String switchId, Position target, StatePublisher publisher, ZonedDateTime now) {
        this.lock.lock();
        try {
            this.touch(now);
            Twin.Step step = this.twin.operate(switchId, target);
            return switch (step.result()) {
                case OperationResult.Refused refused ->
                        throw new TwinException(TwinFailure.of(refused.refusal()));
                case OperationResult.Accepted accepted when !accepted.changed() -> this.current();
                case OperationResult.Accepted ignored -> this.advance(step.twin(), publisher);
            };
        } finally {
            this.lock.unlock();
        }
    }

    public Versioned scaleLoad(double factor, StatePublisher publisher, ZonedDateTime now) {
        this.lock.lock();
        try {
            this.touch(now);
            if (factor == this.twin.state().loadFactor()) {
                return this.current();
            }
            return this.advance(this.twin.withLoadFactor(factor), publisher);
        } finally {
            this.lock.unlock();
        }
    }

    public boolean storeReport(long analysedVersion, ContingencyReport result) {
        this.lock.lock();
        try {
            if (analysedVersion != this.version) {
                return false;
            }
            this.report =
                    Optional.of(new AnalysisRecord<>(this.version, this.twin.state(), result));
            return true;
        } finally {
            this.lock.unlock();
        }
    }

    public boolean storeCascade(long analysedVersion, CascadeResult result) {
        this.lock.lock();
        try {
            if (analysedVersion != this.version) {
                return false;
            }
            this.cascade =
                    Optional.of(new AnalysisRecord<>(this.version, this.twin.state(), result));
            return true;
        } finally {
            this.lock.unlock();
        }
    }

    public Optional<AnalysisRecord<ContingencyReport>> report() {
        this.lock.lock();
        try {
            return this.report;
        } finally {
            this.lock.unlock();
        }
    }

    public Optional<AnalysisRecord<CascadeResult>> cascade() {
        this.lock.lock();
        try {
            return this.cascade;
        } finally {
            this.lock.unlock();
        }
    }

    private Versioned current() {
        return new Versioned(this.version, this.twin.solution());
    }

    private Versioned advance(Twin next, StatePublisher publisher) {
        this.twin = next;
        this.version++;
        this.report = Optional.empty();
        this.cascade = Optional.empty();
        Versioned state = this.current();
        publisher.publish(this.id, state);
        return state;
    }

    public record Snapshot(long version, Twin twin) {

        public Versioned versioned() {
            return new Versioned(this.version, this.twin.solution());
        }
    }
}
