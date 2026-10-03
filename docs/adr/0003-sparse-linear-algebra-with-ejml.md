# 0003 Sparse linear algebra with EJML behind a port

Status: accepted

## Context

Newton-Raphson needs one sparse linear solve per iteration. The brief says to use EJML if its sparse LU is good enough and to write an own LU otherwise.

What was checked on 2026-10-03:

- `ejml-dsparse` 0.46.1 is on Maven Central and tagged `v0.46.1` on GitHub, under Apache 2.0. The ejml.org front page still names 0.45.0 as the latest release.
- `LinearSolverFactory_DSCC.lu(FillReducing)` returns a `LinearSolverSparse` for matrices in compressed-column form. The implementation is `LuUpLooking_DSCC`. A 3 by 3 system solved with it gave the expected answer.
- `FillReducing` has three values in this release: `NONE`, `RANDOM` and `IDENTITY`. There is no AMD, COLAMD or reverse Cuthill-McKee ordering.
- The documentation does not say whether solver instances are thread-safe.

The Jacobians in this project are small. IEEE 14 gives 22 unknowns and IEEE 30 gives 53.

## Decision

Use `LinearSolverFactory_DSCC.lu(FillReducing.NONE)` behind a `SparseLinearSolver` port defined in `domain`. The Jacobian is assembled in compressed-column form on every iteration. Every power flow run, and every parallel contingency task, creates its own solver instance.

## Alternatives

An own sparse LU with a minimum-degree ordering would be more code to test and gain nothing at 53 unknowns. The port keeps that option open.

Dense LU from `ejml-ddense` would work at this size, but the brief asks for sparse linear algebra. A native library such as SuiteSparse would add a platform dependency to a project that runs in a plain JRE image.

## Consequences

There is no fill reduction, so the solver would not scale to networks with thousands of buses. The README says so under limitations. The assembly code and the Jacobian tests do not depend on EJML types because they go through the port.

## Findings from milestone 2

- `LuUpLooking_DSCC` takes the Jacobian when it is assembled with sorted row indices in every column. `setA` returns false for a singular matrix (a test covers a rank-deficient matrix and an empty one), which the solver port reports as an empty result and the power flow reports as a collapsed island.
- The domain owns the matrix type (`CompressedColumnMatrix`). Only `EjmlSparseLuSolver` knows EJML classes, and it copies the arrays into a `DMatrixSparseCSC`.
- The Jacobian is rebuilt in every iteration, with no cached structure. At 22 and 53 unknowns that is simple and fast enough for the targets in the brief. The M4 benchmarks will say whether it matters.
- One `EjmlSparseLuSolver` is created per power flow run. Nothing is shared between threads.

