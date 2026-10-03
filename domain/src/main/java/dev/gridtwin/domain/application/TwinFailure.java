package dev.gridtwin.domain.application;

import dev.gridtwin.domain.topology.Refusal;

public sealed interface TwinFailure
        permits TwinFailure.UnknownSession,
                TwinFailure.UnknownCase,
                TwinFailure.SessionLimitReached,
                TwinFailure.UnknownSwitch,
                TwinFailure.OperationRefused,
                TwinFailure.InvalidInput,
                TwinFailure.UnknownContingency,
                TwinFailure.NoContingencyResult,
                TwinFailure.NoCascadeResult {

    static TwinFailure of(Refusal refusal) {
        return refusal instanceof Refusal.UnknownSwitch unknown
                ? new UnknownSwitch(unknown.switchId())
                : new OperationRefused(refusal);
    }

    String code();

    String message();

    record UnknownSession(String sessionId) implements TwinFailure {

        @Override
        public String code() {
            return "UNKNOWN_SESSION";
        }

        @Override
        public String message() {
            return "There is no session with id " + this.sessionId + ".";
        }
    }

    record UnknownCase(String caseId) implements TwinFailure {

        @Override
        public String code() {
            return "UNKNOWN_CASE";
        }

        @Override
        public String message() {
            return "There is no switchable case with id " + this.caseId + ".";
        }
    }

    record SessionLimitReached(int limit) implements TwinFailure {

        @Override
        public String code() {
            return "SESSION_LIMIT_REACHED";
        }

        @Override
        public String message() {
            return "The server holds " + this.limit + " sessions already. Try again later.";
        }
    }

    record UnknownSwitch(String switchId) implements TwinFailure {

        @Override
        public String code() {
            return "UNKNOWN_SWITCH";
        }

        @Override
        public String message() {
            return "There is no switch with id " + this.switchId + ".";
        }
    }

    record OperationRefused(Refusal refusal) implements TwinFailure {

        @Override
        public String code() {
            return this.refusal.code();
        }

        @Override
        public String message() {
            return this.refusal.message();
        }
    }

    record InvalidInput(String field, String reason) implements TwinFailure {

        @Override
        public String code() {
            return "INVALID_INPUT";
        }

        @Override
        public String message() {
            return this.field + ": " + this.reason;
        }
    }

    record UnknownContingency(String contingencyId) implements TwinFailure {

        @Override
        public String code() {
            return "UNKNOWN_CONTINGENCY";
        }

        @Override
        public String message() {
            return "The last N-1 run has no contingency " + this.contingencyId + ".";
        }
    }

    record NoContingencyResult() implements TwinFailure {

        @Override
        public String code() {
            return "NO_CONTINGENCY_RESULT";
        }

        @Override
        public String message() {
            return "There is no N-1 result for the current state. Run the analysis first.";
        }
    }

    record NoCascadeResult() implements TwinFailure {

        @Override
        public String code() {
            return "NO_CASCADE_RESULT";
        }

        @Override
        public String message() {
            return "There is no cascade result for the current state. Run the cascade first.";
        }
    }
}
