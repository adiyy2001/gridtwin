# 0025 Every number in the README comes from a script

Status: accepted

## Context

The README quotes accuracy against MATPOWER, solve times, N-1 times, test counts and coverage. Numbers typed into prose go stale the first time the code changes, and a reader cannot tell a measurement from a guess. The rule is that every number comes from a script in the repository and that benchmarks print the hardware they ran on.

Three kinds of numbers were missing a script when the application was feature complete: how far the solver is from MATPOWER (the tests only assert a tolerance, they do not report the actual deviation), the coverage figure for the badge, and the front-end timings.

## Decision

- `tools/validation-report.sh` runs `ValidationReportTest`, which compares the solver with every base case reference (two cases, four load factors, with and without reactive limits) and every N-1 reference, and writes the worst voltage, angle and flow deviation of each set. The result is copied to `bench/results/validation.json` and printed by `tools/validation-summary.mjs`. The test also asserts the tolerances above, so the report cannot be written for a failing solver.
- `tools/coverage-badge.mjs` reads the JaCoCo CSV files of the four Java modules and the Istanbul JSON of the Vitest run, counts lines the way each tool counts them, prints a table and writes `docs/badges/coverage.svg`. The badge shows the combined line coverage. No coverage service and no account are involved.
- Timings come from `tools/bench.sh java` and `tools/bench.sh web`. Both write JSON with a hardware header into `bench/results/`.
- The README names the file each number came from. Results that were measured on the development machine say so, with its CPU and the renderer string of the browser.

## Alternatives

A third-party coverage service gives a live badge but needs an account and an upload token, and the number would live outside the repository. Quoting the thresholds of the build as if they were results would be wrong. They are limits, and the real values are higher.

## Consequences

The badge and the result files are committed, so they can be out of date until someone runs the scripts again. The README says which command refreshes each of them. Reference deviations are tiny (below 1e-6 for every compared quantity), and the report shows by how much instead of only that the limit holds.
