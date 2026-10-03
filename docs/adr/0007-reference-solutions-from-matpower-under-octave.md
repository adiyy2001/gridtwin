# 0007 Reference solutions from MATPOWER under Octave

Status: accepted

## Context

The validation suite compares voltages to 1e-6 pu and angles to 1e-4 degrees against reference solutions. The brief says to produce them with MATPOWER under GNU Octave in Docker and to fall back to pandapower.

What was checked on 2026-10-03:

- MATPOWER 8.1 (released 2025-07-13) installs from the GitHub tag archive. The archive has the SHA-256 `aebdc566e7d09a747c9197e7f69815e00cfe1d84db980d2121821b99b679c383`.
- The image `gnuoctave/octave:11.3.0` pulls and runs. It is 5.73 GB. `install_matpower(1, 0, 0)` sets the paths for the session without writing anything, so the MATPOWER directory can be mounted read-only.
- `runpf('case14')` with `pf.tol = 1e-12` reports bus 1 at 1.06 pu, bus 4 at 1.0176708537 pu and -10.3129010923 degrees, and bus 14 at -16.033644529206 degrees. These three numbers are sanity anchors for the validation tests.
- pandapower 3.5.5 is on PyPI and would work as a fallback. It was not needed.

## Decision

`tools/reference/run.sh` downloads MATPOWER 8.1 into `.cache/`, verifies the checksum, runs Octave 11.3.0 in a container named `gridtwin-octave` and writes JSON. The JSON files are committed under `validation/src/test/resources/reference/` with a `provenance` block (MATPOWER version, Octave version, image tag, archive checksum, options).

MATPOWER options: `pf.tol = 1e-12`, `pf.nr.max_it = 30`, `verbose = 0`. Reference sets:

- the base solution of `case14` and `case_ieee30` at load factors 0.5, 1.0, 1.2 and 1.5
- the same sets with `pf.enforce_q_lims = 1`. With the slack limits widened, no generator of `case14` hits a limit at 100% load, generators 2, 3 and 6 hit their upper limits at 120%, and `case_ieee30` already has generator 2 at its upper limit at 100%. At 150% the IEEE 30 solution still converges with a lowest voltage of 0.707 pu and diverges at 160%
- `case14` with bus 4 split into two buses (the substation with the coupler closed and open)
- later, the N-1 outages of `case14` that keep the network connected

For the Q-limit runs, the reference-bus generator gets Q limits of plus and minus 9999 MVAr in the case passed to MATPOWER. With `pf.enforce_q_lims = 1`, MATPOWER also tests the slack generator. In `case14` it violates its lower limit, so MATPOWER turns that bus into a PQ bus and selects a new slack. That is not the behaviour specified in ADR 0004.

`tools/reference/run.sh --check` regenerates into a temporary directory and compares numerically with the committed files. A CI job runs it when anything under `tools/reference/` changes and on manual dispatch.

## Alternatives

pandapower needs a Python environment and uses its own case conversions. A hand-written second implementation would test the code against itself.

## Consequences

The image is large. The script pulls it once and the CI job is not part of every push. Comparisons for outages that change the slack must use angle differences from the island's reference bus, because MATPOWER fixes the new slack at the angle stored for that bus in the case file.
