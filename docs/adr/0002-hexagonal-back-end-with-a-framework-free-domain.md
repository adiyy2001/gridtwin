# 0002 Hexagonal back end with a framework-free domain

Status: accepted

## Context

The back end is a Quarkus application where the math and topology live in a domain module with no framework imports. The domain also has to load case data, and the validation suite has to read both case data and reference solutions. Jackson is a library, so nothing forbids it in the domain. Keeping it out makes the claim simpler to state and to enforce.

## Decision

Five Maven modules.

- `domain` depends on the JDK and EJML only. It holds the network model, the topology processor, the power flow, the contingency and cascade engines, and the application layer (use cases and the ports `SessionRepository`, `StatePublisher` and a clock).
- `cases` depends on `domain` and Jackson. It owns the JSON case files and turns them into domain records.
- `validation` depends on `domain` and `cases` and has test sources only. It holds the MATPOWER references, the validation tests and the property tests.
- `api` is the Quarkus application. It contains the REST and WebSocket adapters, the in-memory session repository, the DTOs and the error mappers.
- `bench` is a plain Java program that times the domain and prints the hardware it ran on.

An ArchUnit test in `api` fails the build if any class in `domain` imports `jakarta.*`, `io.quarkus.*`, `io.vertx.*`, `io.smallrye.*`, `org.eclipse.microprofile.*` or `com.fasterxml.*`, or if `domain` depends on `cases`, `api` or `bench`.

## Alternatives

A single module with package rules would be shorter, but then nothing stops a framework import from slipping into the math. Putting Jackson annotations on domain records would remove the mapping layer and tie the domain to a serialization format.

## Consequences

There are more pom files and a mapping layer between domain records and API DTOs. The domain can be read, tested and benchmarked without starting Quarkus.
