# Task 13 Brief: End-to-End System Integration Test & Verification

## Context & Objectives
You are the implementer for Task 13.
Your goal is to build the comprehensive end-to-end integration test `SyngentaBusinessFlowTest.java` that runs through the complete lifecycle of a Syngenta dealership, verify the full backend build (`./gradlew build`), verify frontend build (`pnpm build`), and update `README.md` with complete documentation.

## Strict Rules
- Ponytail engineering: Clean, comprehensive, zero flaky tests, zero unnecessary bloat.
- Zero assumptions: If any business or technical judgment is made, add `// BUSINESS DECISION:` directly in code and append a line to `DECISIONS_LOG.md`.
- No subagents contract: Do NOT invoke any subagents. You do all work directly.
- Both `./gradlew build` and `pnpm build` must pass cleanly.

## Deliverables

### 1. `backend/src/test/java/com/alamin/pos/e2e/SyngentaBusinessFlowTest.java`
Write a `@SpringBootTest` testing the complete business flow:
1. **Shipment Arrival**: Record lot for Amistar Top (2 cartons = 40 bottles @ ৳500 purchase cost, entry date today, challan `CH-E2E-001`). Verify 40 bottles in `GODOWN`, `PURCHASE_ENTRY` in `godown_movement`.
2. **Internal Transfer**: Transfer 15 bottles from `GODOWN` to `DOKAN`. Verify 25 in `GODOWN`, 15 in `DOKAN`, `TRANSFER_TO_DOKAN` in `godown_movement`.
3. **Wholesale Sale (Split-Stock & Bargaining)**: Sell 20 bottles (15 Dokan + 5 Godown) with price override ৳575 (standard ৳580), discount ৳100, round-off ৳10, payment ৳5,000 cash + ৳3,000 bKash + remaining due. Verify Dokan=0, Godown=20, customer due increased, gross profit exact.
4. **Counter Sale (Negative Stock)**: Sell 3 bottles from Dokan (currently 0). Verify Dokan becomes -3, sale succeeds.
5. **Direct Return**: Return 1 bottle to Dokan with due adjustment. Verify Dokan becomes -2, customer due credited.
6. **Debt Repayment**: Repay ৳2,000 cash with MR No `MR-E2E-999`. Verify customer due drops by ৳2,000, ledger row has MR number.
7. **Dashboard Summary**: Verify `getSummary()` cash in drawer, market due, and sales metrics match.
8. **1-Click SQL Backup**: Verify `exportSqlBackup()` produces valid SQL statements.

### 2. Full Verification
- Run `./gradlew build` in `backend/` (ensure all tests pass, jar packages).
- Run `pnpm build` in `frontend/` (ensure production bundle compiles cleanly).

### 3. `README.md`
- Complete, professional documentation:
  - System Overview & Syngenta Agrochemical Dealership features.
  - Monorepo structure (`backend/` and `frontend/`).
  - Tech stack (Spring Boot 3, Java 21, Gradle Groovy DSL, Lombok, MapStruct, Flyway, H2/Postgres, React 19, Tailwind CSS v4).
  - Step-by-step instructions to run backend (`./gradlew bootRun`) and frontend (`pnpm dev`).
  - Key operational features (Carton multipliers, FEFO lots, Split stock, Negative stock, Bargaining override, 1-Click backup, Owner PIN mode).

## Reporting
- Commit changes: `feat: add syngenta e2e business flow integration test and comprehensive readme`
- Write report to: `.superpowers/sdd/pos-inventory-syngenta/task-13-report.md`
- Report back with DONE, commit hash, and test verification output.
