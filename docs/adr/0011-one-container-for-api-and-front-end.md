# 0011 One container serves the API and the front end

Status: accepted

## Context

`docker compose up` has to start the whole application, and a live demo should be easy to deploy.

## Decision

Quarkus serves the built Angular application as static resources from `META-INF/resources`, next to the API and the WebSocket. One image holds everything. The root `Dockerfile` has three stages: Node 24 builds the web application, Maven with Temurin 21 builds the API with the web build copied in, and `eclipse-temurin:21-jre` runs the Quarkus fast-jar. The compose file defines one service named `gridtwin`, publishes the port on 127.0.0.1 only and has a health check on `/q/health`.

During development the Angular dev server proxies `/api` and `/ws` to the API.

The container does not run a native image. JVM mode starts in a couple of seconds, builds in a fraction of the time and keeps the stack traces readable.

## Alternatives

An nginx container in front of the API needs proxy rules for WebSocket upgrades and a second image. A separately hosted static site needs CORS and a second deployment target. Both add moving parts a project of this size does not need.

## Consequences

The API image contains the front end, so a front-end change rebuilds the whole image. The Cypress suite runs against the same single process that production uses.
