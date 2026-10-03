# 0008 Property tests with an own harness instead of jqwik

Status: accepted

## Context

The tests were meant to be property tests with jqwik: generation equals load plus losses within 1e-6 pu, and opening then closing a breaker returns the original solution.

What was found on 2026-10-03:

- jqwik 1.10.1 is the latest release. The release notes say that from 1.10 on the project carries an "Anti-AI Usage Clause" and that use with coding agents is strongly discouraged. The user guide says that every run of the test engine prepends a line to stdout, addressed to AI agents, telling them to disregard previous instructions and to ignore all results from jqwik test executions.
- The project is in maintenance mode. Its notes say 1.10.1 is probably the last release built on JUnit Platform 1.x. Quarkus 3.40.1 manages JUnit Jupiter 6.1.3, while jqwik 1.10.1 depends on `junit-platform-engine` 1.14.4.
- The license is EPL-2.0, which is outside the permissive licenses this project allows.
- The older release 1.9.3 predates the clause. Picking it only to avoid the clause would ignore what the maintainers ask.
- The other Java property-testing libraries are unmaintained: junit-quickcheck 1.0 dates from 2020 and QuickTheories 0.26 from 2019.

## Decision

Do not use jqwik. The `validation` module has a small harness of its own, `Property`, in the test sources:

- A property is a generator, a check and a number of tries (default 200).
- Every run uses a seed, taken from `-Dgridtwin.property.seed` or a fixed default, and the failure message prints the seed and the failing input so a run can be repeated.
- Generators build random small networks (3 to 8 buses, meshed, with one or two generators) and random switching sequences.
- Shrinking is limited to what helps here: a failing switching sequence is reduced by removing steps while the failure persists.

The two properties above are implemented as written. Further properties are added: a warm start and a flat start reach the same solution, and a parallel contingency run equals the sequential run.

## Alternatives

jqwik 1.9.3 would give shrinking and a richer generator API for the price of knowingly using a library against its maintainers' stated wish. The harness above is about 150 lines.

I can still switch to jqwik later. The tests are written against the `Property` interface in a way that makes the swap mechanical.

## Consequences

Less generator machinery and weaker shrinking than jqwik.

## Implementation notes for the solver

The harness is in `validation/src/test/java/dev/gridtwin/validation/property/`: `Property`, `Generator`, `Check`, `Discard` and `RandomNetworks`. Try number `i` uses the seed `base + i`, so the seed in a failure message repeats that exact try with `-Dgridtwin.property.seed=<seed> -Dgridtwin.property.tries=1`. A check that throws `Discard` (for a random network without a solution, for example) does not count as a failure. The property fails when more than half of the inputs are discarded, so a loose generator cannot hide behind discards.

The solver tests check these properties on random networks of 3 to 8 buses with taps, phase shifts, shunts and generators with tight reactive limits: generation equals load plus losses plus shunt consumption within 1e-6 pu, with and without reactive limits; every bus balances its injection and its branch flows; no branch has negative losses; a flat start equals a warm start from another load level; taking a branch out of service and back returns the original solution. The breaker version of the last property needs the topology processor, so it lives with the topology tests. Shrinking of switching sequences arrives with it.

## Implementation notes for the topology processor

`Property` now takes an optional `Shrinker` (`shrinkingWith`). When a check fails, the harness asks the shrinker for smaller inputs, keeps the first candidate that still fails (candidates that pass or are discarded are skipped) and repeats until no candidate fails or 500 rounds have passed. The failure message prints the smallest input and the original one. `Shrinkers.list()` offers both halves of a list and every list with one element removed. Switching sequences are lists of steps, so they shrink to the few operations that matter.

The switching properties are in `validation/.../topology/SwitchingPropertiesTest`: random sequences of switch operations and load factor changes on the IEEE 14 substation never throw, never produce NaN, leave every island either energized with a slack or fully de-energized, balance generation against load, shed load and losses, never leave a closed earthing switch on a live section, and refuse operations with a code and a message while leaving the twin untouched. Opening and closing a breaker returns the original solution to 1e-9 (voltage in pu, angle in radians). The property discards starts where the breaker is already open, where a solution collapsed, or where the breaker could not close.
