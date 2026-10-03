# 0019 Sessions, versions and the application layer

Status: accepted

## Context

Every browser tab works on its own copy of the twin. Commands arrive over REST from several tabs and several requests of one tab at once, and the WebSocket has to deliver states in an order the client can trust. ADR 0010 chose REST commands with a WebSocket that pushes the full state. The domain stays free of any framework (ADR 0002), so the session rules need a home that is not Quarkus.

## Decision

The application layer lives in the `domain` module, package `application`, and the `api` module only holds adapters.

- Ports: `SessionRepository`, `StatePublisher`, `ModelCatalog` and `TimeSource`. `TimeSource` exists because the style gate bans the word `Instant`, so `java.time.Clock` cannot be subclassed in tests. It returns a `ZonedDateTime`.
- `SessionService` is the only entry point. It opens, reads, operates, scales the load of, analyses and closes sessions. Failures are a sealed `TwinFailure` carried by `TwinException`, and the adapters map them to HTTP statuses.
- Each `TwinSession` has its own lock. A command takes the lock, changes the state, increments the version and publishes inside the same critical section, so versions reach the WebSocket strictly increasing even with parallel commands. Different sessions never share a lock.
- A session starts at version 1. A command that changes nothing (closing a closed switch, the same load factor) keeps the version and publishes nothing. A refused command changes nothing and publishes nothing.
- N-1 and cascade results are stored with the version and the state they were computed from. A version change drops them, so a preview never describes a state the user has left. The analyses start from the switch states and the load factor of the session, as M4 required.
- The registry is capped (200 sessions) and idle sessions expire after 30 minutes. A scheduled janitor evicts them. A full registry answers 429 instead of evicting a session that may be in use.
- The contingency engine runs on one long-lived `ForkJoinPool` created by a CDI producer with a disposer (ADR 0009), never per request.

## Consequences

- The application layer is tested in the domain module with in-memory ports, at the domain coverage threshold, without starting Quarkus.
- A session lives in the memory of one process. A restart loses sessions, which is accepted for a demo and said in the README. The `SessionRepository` port is where a shared store would go.
- Publishing under the lock means a slow WebSocket subscriber could delay a command. The adapter starts each send without waiting for the client and only logs a failed delivery, so a command never waits for a slow client. A client that missed a push catches up from the next one, because every message carries the full state.
