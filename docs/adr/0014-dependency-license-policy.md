# 0014 Dependency license policy and the JMH decision

Status: accepted

## Context

The project allows only permissive dependencies (MIT, Apache 2.0, BSD, ISC). Several standard tools in the Java and browser ecosystems use other licenses. Checked in Maven POMs and the npm registry on 2026-10-03:

- JUnit Jupiter 6.1.3, JaCoCo 0.8.15 and jqwik: EPL-2.0
- Checkstyle 14.3.0: LGPL-2.1 or later
- axe-core 4.13.0, which Lighthouse and `@axe-core/playwright` use: MPL-2.0
- JMH 1.37: GPL-2.0 with the Classpath Exception

## Decision

Code that is linked into or shipped with the application is permissive only. That covers Quarkus, EJML, Jackson, Angular, RxJS, NgRx, Three.js and the Angular CDK.

Build and test tools that are not distributed with the application may use any OSI-approved license. JUnit, JaCoCo, Checkstyle and axe-core fall in this group. CREDITS.md lists them in a separate "build and test tools" section with their licenses.

JMH is not used even though it is only a benchmark tool. The `bench` module has a small harness of its own: fixed warm-up iterations, a fixed number of measured iterations, median and 95th percentile, and a header that prints the CPU model, core count, memory, operating system and JVM. The browser benchmarks print the browser name and version.

## Alternatives

Accept JMH as a tool. It measures more carefully than a hand-made harness. The harness documents its method, and the timing targets (10 ms and 500 ms) are far above the noise.

## Consequences

The benchmark numbers come from a simpler method than JMH's, and the README says which. CREDITS.md has a separate section for build and test tools.
