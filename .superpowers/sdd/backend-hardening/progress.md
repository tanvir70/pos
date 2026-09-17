# SDD ledger — plan: docs/superpowers/plans/2026-09-17-backend-hardening-remediation.md

## Preflight Scan
| Tasks | Consumes vs Produces | Status | Ruling |
| :--- | :--- | :--- | :--- |
| Task 1 -> Task 2 | Flyway V3 DDL -> JPA Entities & Enums | Clean | Proceed (hold quarantine_quantity DDL) |
| Task 2 -> Task 3 | Versioned Entities -> Pessimistic Locking & Sequences | Clean | Proceed |
| Task 3 -> Task 4 | Concurrency Lock -> Financial Precision Engine | Clean | Proceed |
| Task 3 -> Task 5 | Concurrency Lock -> Regulatory & Return Validations | Modified | Ruling: User requested to hold the quarantine part of Task 5. Proceed with expired lot blocker, FEFO warning, and invoice-linked return validation. Do not route damaged returns into a quarantine stock table. |
| Task 2 -> Task 6 | Domain Enums -> Spring Security & Cost Masking | Clean | Proceed |
| Task 6 -> Task 7 | Security Config -> DoS & Streaming Backup Protection | Clean | Proceed |
| Task 3,4,5 -> Task 8 | Service Logic -> N+1 Removal & Clean API Pagination | Clean | Proceed |
| Task 2,8 -> Task 9 | DTOs & Models -> Bean Validation & RFC 7807 Errors | Clean | Proceed |
| Task 1,2,6 -> Task 10 | Idempotency Schema -> Idempotency Filter Engine | Clean | Proceed |
| Task 1..10 -> Task 11 | All Hardened Modules -> Concurrency & Regression Suite | Clean | Proceed |

## Explicit User Rulings
- **Ruling on Task 5 (Quarantine):** Hold the quarantine inventory tracking part. Do not add quarantine stock balances or quarantine inventory routing for damaged returns. Still enforce:
  1. Expired lot blocker (throw `ExpiredLotSaleException` on expired lots).
  2. FEFO ordering check & audit warnings.
  3. Strict invoice-linked return validation (item presence, original unit price, cumulative return quantity $\le$ invoiced quantity).
  4. Damaged returns will not increment active salable inventory (logged and acknowledged without quarantine stock table).

## Task Execution Log
| Task | Description | Status | Commit |
| :--- | :--- | :--- | :--- |
| Task 1 | Database Hardening & Enterprise Schema Migration (Flyway V3) | DONE | `d629068` |
| Task 2 | Domain Enums, Entity Hardening & Concurrency Mappings | DONE | `cd7e5cf` |
| Task 3 | Concurrency Engine & Atomic Document Sequencing | DONE | `5812fa3` |
| Task 4 | Financial Math & Accounting Precision Engine | DONE | `f2ad9e7` |
| Task 5 | Agrochemical Regulatory Compliance & Strict Return Validation (Excluding Quarantine) | DONE | `a09ab27` |
| Task 6 | Enterprise Security, Role-Based Access Control & Cost Masking | DONE | `f60f872` |
| Task 7 | Resource Exhaustion & Denial of Service Protection | DONE | `89bf63d` |
| Task 8 | Clean Architecture, N+1 Query Elimination & Pagination | DONE | `32e12a1` |
| Task 9 | Comprehensive Bean Validation & RFC 7807 Problem Details | DONE | `8e9500e` |
| Task 10 | Transaction Idempotency Filter & Replay Prevention | DONE | `45bb191` |
| Task 11 | End-to-End System Regression & Concurrency Stress Test Suite | DONE | `1dc32f1` |
