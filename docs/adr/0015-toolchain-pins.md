# 0015 Toolchain pins

Status: accepted

## Context

Several tools have a newer major version than the brief assumes. All versions below were read from the npm registry, Maven Central, GitHub releases or the vendor site on 2026-10-03. PLAN.md has the full table with sources.

## Decision

- Quarkus 3.40.1, the current LTS. Quarkus 4.0.0.Beta1 appeared on 2026-10-01 and is a beta.
- Java 21, as the brief requires. The machine has OpenJDK 21.0.12.1. The runtime has the `jdk.compiler` module, so Maven compiles, but the `javac` and `javap` commands are not installed. Newer LTS releases are not used.
- Node 24.21.0 (LTS). Angular 22.2.1 requires Node `^22.22.3 || ^24.15.0 || >=26`, and the default nvm version on the machine, 24.13.0, is too old. Node 24.21.0 is installed under nvm.
- TypeScript 6.0.3. TypeScript 7.0.2 is the latest release, but `@angular/compiler-cli` 22.2.1 accepts `>=6.0 <6.1` only, and typescript-eslint 8.71.0 accepts up to `<6.1.0`.
- Angular 22.2.1, zoneless by default since v21. NgRx Signals 22.0.1, RxJS 7.8.2.
- Cypress 16.1.1. It removed `cy.exec`, `Cypress.env` and `cy.end`, so tests use `Cypress.expose` and `cy.env`. `cypress-axe` 1.7.0 declares peers up to Cypress 15, so accessibility checks run in Playwright with `@axe-core/playwright`.
- Maven 3.9.16, as in the Quarkus guide.

## Alternatives

Waiting for TypeScript 7 support in Angular, or running Quarkus 4 beta, would put pre-release or unsupported combinations into a project whose point is to be reproducible.

## Consequences

The Node path in the global environment notes (24.13.0) does not work for this repository. Every script and CI job uses the version in `.nvmrc`. When TypeScript 7 support lands in Angular, the pin is a one-line change.
