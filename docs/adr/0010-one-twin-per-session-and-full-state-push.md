# 0010 One twin per session and full state push over WebSocket

Status: accepted

## Context

The brief asks for REST commands and a WebSocket that pushes the full versioned state after every solve. The twin has mutable state: switch positions and the load factor. A public demo with one shared twin would let one visitor open a breaker under another visitor's hands, and parallel end-to-end tests would interfere with each other.

## Decision

- `POST /api/sessions` creates a twin for a chosen network and returns its id and the first state. Every other call includes the session id.
- A session handles one command at a time. Each accepted command solves the network once, increments `version` and publishes the new state. A refused command changes nothing and does not increment the version.
- The WebSocket at `/ws/sessions/{id}` sends the full state on connect and after every version change. A message is `{ "version": n, "state": { ... } }`. Clients ignore a message with a version at or below the one they already show.
- The REST response to a command carries the same state, so a client that has no socket still works.
- N-1 and cascade results are returned by their own REST calls and are kept in the session, so the front end can preview one contingency or step through a cascade without a new solve. They are not part of the pushed state.
- Sessions are held in memory. The registry caps the number of sessions and drops idle ones after a time to live. Time comes from an injected clock and uses `ZonedDateTime`.

## Alternatives

One shared twin is simpler and breaks as described above. Pushing diffs saves bytes, but the state for these networks is a few kilobytes, and a full snapshot means a reconnecting client needs no replay logic.

## Consequences

The server holds state for every open session, bounded by the cap. There is no authentication, so session ids are random 128-bit values. A restart drops all sessions and the front end creates a new one.
