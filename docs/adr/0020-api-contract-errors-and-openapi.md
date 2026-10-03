# 0020 API contract, errors and the OpenAPI file

Status: accepted

## Context

The web client in M6 is generated from the API description, so the description has to be exact: which fields are always present, which are optional, and which errors a call can return. The contract also has to stay honest as the code changes.

## Decision

- Routes live under `/api`, the WebSocket at `/ws/sessions/{sessionId}`. Health and the OpenAPI document come from the standard Quarkus endpoints.
- Errors are one JSON shape, `{code, message}`, produced by `@ServerExceptionMapper`s from the sealed `TwinFailure`: 404 for an unknown session or equipment, 409 for an operation the interlocks refuse (the code is the refusal reason, the message is the sentence a person reads), 400 for invalid input, 429 when the session cap is reached. Malformed JSON, an unknown enum value and a missing body are also 400 with the same shape, because the default Quarkus mappers hide the detail.
- DTOs are records with static factory methods. They are the only types that cross the HTTP boundary, so the domain can change without a contract change.
- Jackson omits empty `Optional` values. Optional fields are therefore absent, never `null`, and the generated schema says so.
- Optional enums are exposed as strings. SmallRye OpenAPI cannot mark a `$ref` to an enum as nullable, and a string keeps the generated types simple.
- The schema is generated at build time, post-processed by a small `OASFilter` that marks every non-optional property as required, and compared with `docs/api/openapi.json` by a test. A difference fails the build. `tools/gen-api-types.sh --refresh` regenerates the file (`-Dgridtwin.openapi.update=true`) and then the TypeScript types with `openapi-typescript` 7.13.0.
- Coverage is measured with the JaCoCo Maven plugin only. Adding `quarkus-jacoco` on top wrote a second, empty report into the same folder, so the extension is left out and the plugin attaches to the test JVM that Quarkus starts.
- Architecture rules (ArchUnit) fail the build when the domain imports an adapter or a framework, or when the adapters depend on each other in the wrong direction.

## Consequences

- A change to a DTO or a route needs a deliberate update of the snapshot, which shows in review.
- The frontend never writes an API type by hand.
- The WebSocket is not part of the OpenAPI file. Its message is the `VersionedStateDto` schema, which the generated types contain.
