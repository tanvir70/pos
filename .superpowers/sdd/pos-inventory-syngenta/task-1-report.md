# Task 1 Report: Monorepo Scaffolding & Directory Setup

**Status:** DONE
**Commit Hash:** `26a9dae` (`feat: scaffold monorepo with backend and frontend`)

## Summary of Accomplishments
1. **Frontend Restructuring**:
   - Moved frontend prototype files (`src/`, `index.html`, `vite.config.ts`, `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `.figma/`) cleanly into `frontend/` directory with git rename history preserved.
   - Cleaned root obsolete `node_modules/`.
   - Verified `pnpm install` and `pnpm build` in `frontend/` runs without errors (built in 249ms).
2. **Backend Scaffolding**:
   - Initialized Spring Boot 3.3.3 application with Java 21 toolchain and Gradle 8.13.
   - Configured `backend/settings.gradle` (`rootProject.name = 'pos-backend'`).
   - Configured `backend/build.gradle` (Groovy DSL) with all required dependencies:
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
   - Configured `backend/src/main/resources/application.yml` with H2 persistent file storage (`./data/posdb;AUTO_SERVER=TRUE`) and Flyway enabled.
   - Added `PosApplication.java` entrypoint and `PosApplicationTests.java` context loads test.
   - Configured Gradle wrapper (`gradlew`, `gradlew.bat`, `gradle-wrapper.jar`, `gradle-wrapper.properties`).
   - Configured `gradle.properties` (`org.gradle.java.home`) targeting Java 21 LTS to prevent Gradle 8 crashes against Java 25 host default.
3. **Ponytail & Decisions**:
   - Minimal, zero-bloat setup adhering strictly to required dependencies.
   - Documented JVM pinning decision in code and updated `DECISIONS_LOG.md`.

## Test Outputs
- **Backend Test:**
  Command: `./gradlew test --rerun-tasks`
  Result:
  ```
  > Task :compileJava
  > Task :processResources
  > Task :classes
  > Task :compileTestJava
  > Task :processTestResources NO-SOURCE
  > Task :testClasses
  2026-09-17T01:34:24.940+06:00  INFO 1209592 --- [pos-backend] [ionShutdownHook] j.LocalContainerEntityManagerFactoryBean : Closing JPA EntityManagerFactory for persistence unit 'default'
  2026-09-17T01:34:24.944+06:00  INFO 1209592 --- [pos-backend] [ionShutdownHook] com.zaxxer.hikari.HikariDataSource       : HikariPool-1 - Shutdown initiated...
  2026-09-17T01:34:24.950+06:00  INFO 1209592 --- [pos-backend] [ionShutdownHook] com.zaxxer.hikari.HikariDataSource       : HikariPool-1 - Shutdown completed.
  > Task :test

  BUILD SUCCESSFUL in 7s
  4 actionable tasks: 4 executed
  ```
- **Frontend Build:**
  Command: `pnpm build`
  Result:
  ```
  $ vite build
  vite v8.0.5 building client environment for production...
  transforming (16) src/index.css✓ 16 modules transformed.
  rendering chunks (1)...computing gzip size...
  dist/robots.txt                   0.02 kB │ gzip:  0.04 kB
  dist/index.html                   0.95 kB │ gzip:  0.43 kB
  dist/assets/index-Cyzd3Nbz.css   26.13 kB │ gzip:  5.71 kB
  dist/assets/index-w_Ihl9mL.js   226.56 kB │ gzip: 68.01 kB
  ✓ built in 249ms
  ```

## Concerns / Next Steps
- Zero blocking concerns.
- Ready for Task 2: Database Schema & Flyway Migration (`V1__init_syngenta_schema.sql` and `V2__seed_syngenta_data.sql`).
