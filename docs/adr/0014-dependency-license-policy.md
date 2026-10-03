# 0014 Dependency license policy and the JMH decision

Status: accepted

## Context

The project allows only permissive dependencies (MIT, Apache 2.0, BSD, ISC). Several standard tools in the Java and browser ecosystems use other licenses. Checked in Maven POMs and the npm registry on 2026-10-03:

- JUnit Jupiter 6.1.3, JaCoCo 0.8.15 and jqwik: EPL-2.0
- Checkstyle 14.3.0: LGPL-2.1 or later
- axe-core 4.13.0, which Lighthouse and `@axe-core/playwright` use: MPL-2.0
- JMH 1.37: GPL-2.0 with the Classpath Exception

## Decision

The code of this repository and the libraries I chose are permissive only: Quarkus, EJML, Jackson, Angular, RxJS, NgRx, Three.js and the Angular CDK. Quarkus itself requires a few Eclipse libraries that are not permissive. The application image contains eight unmodified jars under the Eclipse Public License 2.0 (the Jakarta annotation, EL, interceptor, JSON, transaction and REST APIs, Parsson and Expressly), which is weak copyleft at file level and is not on the permissive list. Two more Jakarta jars are under the EDL 1.0, which is BSD-3-Clause. I accept these because nothing in the project works without Quarkus and because I do not modify or copy them. Where a library offers a choice (Vert.x, for example), I use its Apache-2.0 option.

Build and test tools that are not distributed with the application may use any OSI-approved license. JUnit, JaCoCo, Checkstyle, axe-core and lightningcss fall in this group, and so do caniuse-lite (CC-BY-4.0 data) and argparse (Python-2.0). CREDITS.md lists them in a separate "build and test tools" section with their licenses.

`tools/licenses.sh` generates `docs/third-party-licenses.md` from the Maven dependency tree of the `api` module and from pnpm, so the lists cannot drift from the real dependencies. CI runs it with `--check`.

JMH is not used even though it is only a benchmark tool. The `bench` module has a small harness of its own: fixed warm-up iterations, a fixed number of measured iterations, median and 95th percentile, and a header that prints the CPU model, core count, memory, operating system and JVM. The browser benchmarks print the browser name and version.

## Alternatives

Accept JMH as a tool. It measures more carefully than a hand-made harness. The harness documents its method, and the timing targets (10 ms and 500 ms) are far above the noise.

## Consequences

The benchmark numbers come from a simpler method than JMH's, and the README says which. CREDITS.md has a separate section for build and test tools. The statement that the application is permissive only would have been false, so it says what is true: the code I wrote and chose is permissive, and eight Eclipse jars that Quarkus needs are not.
