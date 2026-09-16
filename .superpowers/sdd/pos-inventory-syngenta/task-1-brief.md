# Task 1 Brief: Monorepo Scaffolding & Directory Setup

**Plan Reference:** Task 1 from `docs/superpowers/plans/2026-09-16-pos-inventory-syngenta.md`

## Objectives
1. Restructure the workspace into a clean monorepo:
   - `backend/` (Spring Boot 3 + Java 21 + Gradle Groovy DSL)
   - `frontend/` (React 19 + Vite + Tailwind CSS v4)
2. In `frontend/`:
   - Move existing `src/`, `index.html`, `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `vite.config.ts`, `.figma/`, and related frontend assets into `frontend/`.
   - Ensure `pnpm build` works cleanly in `frontend/`.
3. In `backend/`:
   - Write `backend/build.gradle` (Groovy DSL) with:
     - Spring Boot 3.3.3, Java 21 toolchain
     - Spring Web (`spring-boot-starter-web`)
     - Spring Data JPA (`spring-boot-starter-data-jpa`)
     - Validation (`spring-boot-starter-validation`)
     - Flyway (`org.flywaydb:flyway-core`)
     - H2 database (`com.h2database:h2` runtimeOnly)
     - PostgreSQL (`org.postgresql:postgresql` runtimeOnly)
     - ZXing barcode library (`com.google.zxing:core:3.5.3`, `com.google.zxing:javase:3.5.3`)
     - Lombok (`org.projectlombok:lombok:1.18.34`)
     - MapStruct (`org.mapstruct:mapstruct:1.6.0`, `org.mapstruct:mapstruct-processor:1.6.0`)
     - Lombok-Mapstruct Binding (`org.projectlombok:lombok-mapstruct-binding:0.2.0`)
     - Spring Boot Starter Test (`spring-boot-starter-test`)
   - Write `backend/settings.gradle` with `rootProject.name = 'pos-backend'`.
   - Write `backend/src/main/resources/application.yml` configured for H2 in persistent file mode (`./data/posdb;AUTO_SERVER=TRUE`) with Flyway enabled.
   - Write `backend/src/main/java/com/alamin/pos/PosApplication.java` entrypoint.
   - Write `backend/src/test/java/com/alamin/pos/PosApplicationTests.java` basic test.
   - Add Gradle wrapper files so `./gradlew` is self-contained.
4. Ponytail rules:
   - Zero bloat, no unneeded dependencies, minimal clean configuration.
   - If any business decision arises, annotate with `// BUSINESS DECISION: ...` and append to `DECISIONS_LOG.md`.

## Report Contract
Write report to `.superpowers/sdd/pos-inventory-syngenta/task-1-report.md`.
Report status as `DONE`, list commits, test outputs, and any concerns.
