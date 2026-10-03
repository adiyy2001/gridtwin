# 0012 Vitest for front-end unit tests

Status: accepted

## Context

Jest was my first choice, unless the current Angular CLI default is clearly the better fit. Angular 22.2.1 uses Vitest as the default unit test runner, through the `@angular/build:unit-test` builder, and its peer range accepts Vitest 4.0.8 or newer and 5.x. The Angular testing guide does not mention Jest. `jest-preset-angular` 17 exists and accepts Angular up to 22, but it runs a second transform pipeline beside the esbuild-based one that builds the application.

Much of the front-end logic is plain TypeScript: the single-line diagram layout, symbol geometry, the procedural scene builders, colour scales and the store. It runs in the same runner without Angular.

## Decision

Vitest 5.0.3 with `@vitest/coverage-v8` and jsdom 30. Angular tests run through the CLI builder. Pure TypeScript tests use the same runner. Coverage thresholds are enforced in the configuration: 90% lines for layout, geometry and state logic, 80% for the rest.

## Alternatives

Jest 30.5.2 with `jest-preset-angular` 17 matches the daily stack. It would be a manual setup against a CLI that no longer supports it.

## Consequences

Test code uses `vi` where Jest code uses `jest`.
