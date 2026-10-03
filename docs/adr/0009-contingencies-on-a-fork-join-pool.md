# 0009 Contingencies on a fork-join pool, not virtual threads

Status: accepted

## Context

N-1 analysis runs one outage per branch and per generator, each solved from a warm start. IEEE 30 has 41 branches and 6 generators, so about 47 independent solves. Each solve is CPU work with no blocking and no I/O.

Virtual threads are scheduled onto a small pool of carrier threads, sized by default to the number of cores. They help when many threads spend most of their time waiting. A virtual thread that computes keeps its carrier busy exactly as a platform thread does, so 47 virtual threads on 20 cores give no more throughput than 20 platform threads and add scheduling overhead.

## Decision

Run contingencies on a dedicated `ForkJoinPool` with parallelism equal to `Runtime.availableProcessors()`, through `pool.submit(() -> outages.parallelStream()...)`. The common pool is not used so that a long N-1 run cannot starve other work in the Quarkus process.

Each task works on the immutable base network with its own overlay for the outage and its own `SparseLinearSolver` instance. Nothing is shared between tasks except read-only data. Results are collected in outage order, so a parallel run and a sequential run return equal lists, and a property test checks this.

The analysis takes a `parallelism` argument. The `bench` module reports sequential and parallel times on IEEE 14 and IEEE 30. If the parallel run is slower on IEEE 14, where each solve takes well under a millisecond, the report says so.

## Alternatives

Virtual threads, with the argument above. Plain `parallelStream()` on the common pool is shorter and shares workers with everything else in the JVM.

## Consequences

The parallel path adds a pool lifecycle to the application layer (created at startup and closed at shutdown). The speed-up is whatever the bench measures.

## Implementation notes from milestone 4

- `ContingencyAnalysis.run(source, base)` runs sequentially. `run(source, base, pool)` submits the parallel stream to the pool it is given and `run(source, base, parallelism)` creates and closes a pool for one call. The application layer owns a long-lived pool.
- Tasks share nothing but immutable data. `PowerFlow` creates one `SparseLinearSolver` per solve, so there is no solver to share. A property test runs random networks through a sequential and a parallel analysis and requires equal reports, and the same is checked for IEEE 14 and IEEE 30 at 2, 4 and 8 threads.
- The outage list is built from the base topology, in network order: branches first, then generators. Equipment that is already out of service in the base state gets no outage.
- `bench/results/java.json` has the measured times, with the hardware header. On the machine named there the parallel run is faster than the sequential one for both cases, including IEEE 14 where a solve takes well under a millisecond. The numbers are in the milestone note of `PLAN.md` and in that file.
