# 0016 Build gates and toolchain findings from the skeleton

Status: accepted

## Context

The first milestone put the style gates, the Maven build and the reference pipeline in place. Four things in the plan did not survive contact with the machine or the registries. They are recorded here so nobody has to rediscover them.

## Decision

- Package and coordinates. Group id `dev.gridtwin`, packages `dev.gridtwin.domain`, `dev.gridtwin.cases` and so on. The import rules in `config/import-control.xml` are written against that prefix.
- Compiler settings. The JDK on the development machine is a headless runtime that has the `jdk.compiler` module but no `lib/ct.sym`, so `--release 21` fails with "release version 21 not supported". The build sets `source` and `target` to 21 instead and the enforcer rule requires Java 21 or newer. CI uses Temurin 21, where both settings behave the same. The compiler runs with `-Xlint:all` and fails on warnings.
- Formatting. Spotless 3.10.3 runs google-java-format in AOSP style. Version 1.37.0 of the formatter (released 2026-10-01) changes `JavaFormatterOptions.Style` (the jar now has a `Style.Builder` class) and Spotless 3.10.3 fails on every file with an `InvocationTargetException`, while 1.35.0 and 1.36.0 work. The build pins 1.36.0. The pin moves when Spotless supports 1.37. The Maven JVM needs `--add-exports jdk.compiler/...` flags for the formatter, which `.mvn/jvm.config` provides.
- Comment ban in Java. Checkstyle has no check that rejects comments directly. `TodoComment` with the format `(?s).*` matches every single-line, block and Javadoc comment, so any comment fails `validate`. The `RequireThis` check covers fields and methods, `ImportControl` keeps framework packages out of `domain` and bans `java.time.Instant` everywhere, and a regular expression check catches `Instant` written without an import.
- Style gate for other files. `tools/check-style.mjs` also scans YAML, XML, HTML, SVG, properties files and Dockerfiles for comments, on top of the languages listed in the plan. The Maven wrapper files and lock files are skipped because they are generated.
- Running the gate's tests. On Node 24, `node --test tools/` treats the directory as a single module and fails. `tools/index.js` is that module: it imports every `*.test.mjs` under `tools/`, so the command from the plan works unchanged.
- Case and reference files are plain JSON written by Octave scripts. The numeric comparison in `run.sh --check` uses an absolute and relative tolerance of 1e-9, because the same scripts under the same image reproduce the same numbers and anything larger is a real change.

## Alternatives

A Checkstyle suppression-style regular expression on `//` and `/*` would report false positives on string literals such as URLs. Dropping Spotless would remove the formatter pin but would leave formatting to review. Keeping `--release` would need a full JDK on every machine, including Adrian's, for no gain at Java 21.

## Consequences

The formatter pin and the missing `--release` flag are the two places where the build is deliberately less strict than the plan. Both are one-line changes once the tools allow them.
