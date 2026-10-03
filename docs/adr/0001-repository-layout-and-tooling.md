# 0001 Repository layout and tooling

Status: accepted

## Context

The project has a Java back end, an Angular front end, browser tests, and a small Octave pipeline that produces reference solutions. It lives in one repository so that a reviewer can clone it once and run everything. The front end and the back end share one contract (the state DTO), so keeping them together makes contract changes a single commit.

## Decision

- One repository.
- Java: a Maven multi-module build at the root, with the Maven wrapper pinned to 3.9.16. Modules are `domain`, `cases`, `validation`, `api` and `bench` (see ADR 0002).
- Front end: an Angular CLI workspace in `web/` with one application. Feature folders (`core`, `sld`, `scene`, `network`, `panels`) are separated by ESLint import rules.
- Browser tests: `e2e/` holds the Cypress suite, the Playwright visual suite and the Lighthouse run.
- Package manager: pnpm 11 with a workspace of `web/` and `e2e/`.
- Scripts: `tools/` holds the reference pipeline, the style gate and the build helpers.
- Nx is not used.

## Alternatives

Nx 23.2.1 supports Angular 22, but this repository has one Angular application and one end-to-end package. The task graph and generators would add configuration without removing any work, and the Java side would sit outside the graph anyway.

Gradle is a valid build tool for Quarkus. The brief and the daily stack use Maven, so Maven stays.

## Consequences

Two build systems share the repository. `tools/build-all.sh` builds the web application, copies it into the API module and runs the Maven package step. CI runs the Java and web jobs in parallel and joins them in the end-to-end job.
