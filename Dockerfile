FROM node:24-alpine AS web
RUN corepack enable && corepack prepare pnpm@11.5.3 --activate
WORKDIR /build
ENV CYPRESS_INSTALL_BINARY=0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY web/package.json web/
COPY e2e/package.json e2e/
RUN pnpm install --frozen-lockfile --filter web...
COPY web web
RUN pnpm --dir web run build

FROM maven:3.9-eclipse-temurin-21 AS api
WORKDIR /build
COPY .mvn .mvn
COPY mvnw pom.xml ./
COPY domain domain
COPY cases cases
COPY api api
COPY validation validation
COPY bench bench
COPY config config
COPY --from=web /build/web/dist/web/browser/ api/src/main/resources/META-INF/resources/
RUN mvn -B -ntp -T 1 -pl api -am package -DskipTests

FROM eclipse-temurin:21-jre
RUN useradd --system --create-home --uid 10001 gridtwin
WORKDIR /app
COPY --from=api --chown=gridtwin /build/api/target/quarkus-app/ ./
USER gridtwin
ENV QUARKUS_HTTP_HOST=0.0.0.0 \
    QUARKUS_HTTP_PORT=8080
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/quarkus-run.jar"]
