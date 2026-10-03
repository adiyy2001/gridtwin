# 0022 Continuous integration layout

Status: accepted

## Context

The Definition of Done asks for lint, type check, unit, integration, end-to-end and build runs in GitHub Actions, and the same commands have to work locally. `act` is not installed on the development machine.

## Decision

One workflow, `ci.yml`, with independent jobs so a failure names its cause:

- `style`: the style gate and its tests.
- `java`: `./mvnw verify` (formatting, Checkstyle, unit, integration, validation and property tests, coverage thresholds).
- `web`: lint, type check, Vitest with coverage thresholds, production build.
- `e2e`: `tools/build-all.sh` (web into the jar), Cypress against the jar, the axe run, Lighthouse, the visual suite of the 3D scene, the demo scenario and a quick web benchmark run. Screenshots, the demo video and the benchmark results are uploaded as artifacts.
- `docker`: `docker compose up --build --wait`, the API smoke script against the container, `docker compose down`.
- `changes` and `references`: `changes` compares the reference inputs with the base commit, and `references` regenerates the MATPOWER references and compares them only when those inputs changed or the run is started by hand.

Every job calls the same commands as the table in PLAN.md. Action versions are major tags. The workflow is checked with `rhysd/actionlint` in its Docker image, since `act` cannot run here.

## Alternatives

One long job is simpler and repeats the Java and Node setup less. It also hides which part failed and cannot run the parts in parallel.

## Consequences

The jobs that build the web application each install their own dependencies. The Cypress binary is cached by lock file hash. The references job needs the Octave image, which is large, so it stays conditional.
