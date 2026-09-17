# Backend Hardening & Enterprise Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the POS & Inventory Prototype backend into a fault-tolerant, GAAP-compliant, regulatory-sound, and high-concurrency enterprise system. Completely resolve all race conditions, financial calculation bugs, security flaws, agrochemical regulatory omissions, and architectural bottlenecks identified during the comprehensive audit.

**Architecture:** Spring Boot 3.3.3 + Java 21 LTS + Spring Data JPA + Flyway migrations + Spring Security with Dual Roles (`CASHIER` and `OWNER`). Preserves existing REST API contracts while hardening database consistency via pessimistic/optimistic locking, atomic sequencing, RFC 7807 problem details, idempotency deduplication, and zero-leakage financial accounting.

**Tech Stack:** Java 21, Spring Boot 3.3.3, Spring Data JPA, Spring Security, Flyway, PostgreSQL & H2 (Dual-Compatible), JJWT, MapStruct, Lombok, Gradle, JUnit 5, Mockito, MockMvc.

**Spec Reference:** [`docs/superpowers/specs/2026-09-16-pos-inventory-web-design.md`](file:///home/tanvirar/Desktop/POS%20&%20Inventory%20Prototype/docs/superpowers/specs/2026-09-16-pos-inventory-web-design.md)

---

## Global Architectural & Business Constraints

1. **Concurrency & Locking Discipline:**
   - All stock mutations (`StockInventory`) must be synchronized using row-level pessimistic locking (`@Lock(LockModeType.PESSIMISTIC_WRITE)`) to prevent lost updates in multi-lane checkout counters.
   - All customer credit updates (`Customer.currentDue`) and ledger entries (`CustomerLedger`) must lock the parent `Customer` row before appending ledger records.
   - Entities must include `@Version` fields for optimistic locking detection on concurrent administrative updates.
2. **Deterministic Document Sequencing:**
   - Abandon pseudo-random loops for invoices (`INV-YYYYMMDD-XXXXXX`), returns (`RET-YYYYMMDD-XXXXXX`), and transfers (`TRF-YYYYMMDD-XXXXXX`). Use database-backed atomic sequences (`DocumentSequenceService`).
3. **Financial Mathematics & Accounting Precision:**
   - Round-off change discounts must be deducted from invoice gross profit (`totalProfit = lineProfits - discount - roundOff`).
   - Sales returns must deduct from reported gross revenue and profits in dashboard metrics.
   - Cash tendered and change returned must be tracked explicitly; only net cash retained enters cash drawer balances.
   - Customer payments through digital channels (bKash/Nagad/Bank) must never be categorized as `CASH_PAYMENT`.
4. **Agrochemical Regulatory Compliance (Pesticide Ordinance 1971):**
   - Hard block on sales of expired product lots (`lot.expiryDate < today`).
   - FEFO (First Expired, First Out) ordering validation; log or require supervisor override if an older lot has available stock.
   - Damaged return goods must route directly into `QUARANTINE` inventory, preventing resale while tracking financial write-offs.
5. **Security & Zero-Trust Principle:**
   - Spring Security enabled. Public endpoints strictly limited to authentication and public catalog reads.
   - Owner PIN (4-digit) backed by server-side verification issuing JWT/session credentials.
   - Sensitive financial metrics (purchase cost, unit cost, gross profit) strictly masked for cashiers.
   - Database backups streamed directly without full in-memory buffering.
   - Barcode image dimension maximum limits enforced to block memory exhaustion.
6. **API Architecture & Clean Code:**
   - Eliminate $N+1$ query cascades in `DashboardServiceImpl` with single-query aggregation projections.
   - Implement pagination (`Pageable`, `Page<T>`) across all listing endpoints (`/api/products`, `/api/customers`, `/api/inventory/stock`).
   - Strict DTO encapsulation on `CustomerController` (no exposed entities).
   - Universal Bean Validation (`jakarta.validation`) on all incoming request payloads.
   - Global RFC 7807 Problem Details error responses.
   - Idempotency key tracking (`X-Idempotency-Key`) for checkout and payment mutations.

---

## Preflight Dependency Map

```
Task 1 (Flyway V3 Schema)
   └── Task 2 (Enums & JPA Entity Hardening)
         └── Task 3 (Pessimistic Locking & Document Sequences)
               ├── Task 4 (Financial Math & Cash Drawer Hardening)
               ├── Task 5 (Regulatory Compliance & Return Validation)
               └── Task 6 (Spring Security, Roles & Cost Masking)
                     └── Task 7 (DoS Protection, Streaming Backup & Barcode Limits)
                           └── Task 8 (Clean Architecture, N+1 Removal & Pagination)
                                 └── Task 9 (Bean Validation & RFC 7807 Problem Details)
                                       └── Task 10 (Idempotency Filter & Replay Protection)
                                             └── Task 11 (Regression & Concurrency Stress Suite)
```

---

### Task 1: Database Hardening & Enterprise Schema Migration (Flyway V3)

**Files:**
- Create: `backend/src/main/resources/db/migration/V3__enterprise_hardening.sql`
- Test: `backend/src/test/java/com/alamin/pos/migration/FlywayV3MigrationTest.java`

**Interfaces:**
- Produces: Database schema supporting optimistic versioning, atomic sequences, tender/change amounts, quarantine inventory, composite indexes, and idempotency records.
- Consumes: Existing tables from `V1__init_schema.sql`.

- [x] **Step 1: Write `V3__enterprise_hardening.sql` with cross-database (H2 & PostgreSQL) compatible DDL:**
  - Add `version BIGINT NOT NULL DEFAULT 0` to `products`, `product_lots`, `stock_inventories`, `customers`, and `sales`.
  - Create database sequences: `invoice_number_seq`, `return_number_seq`, `transfer_number_seq` (starting at 1000).
  - Add `cash_tendered NUMERIC(12, 2) DEFAULT 0.00`, `change_amount NUMERIC(12, 2) DEFAULT 0.00` to `sales`.
  - Add `quarantine_quantity NUMERIC(12, 3) DEFAULT 0.000` to `stock_inventories`.
  - Drop foreign key `customer_ledger_customer_id_fkey` and re-add without `ON DELETE CASCADE` (preserve audit trail).
  - Create `idempotency_records` table (`id VARCHAR(64) PRIMARY KEY`, `status VARCHAR(20)`, `response_code INT`, `response_body TEXT`, `created_at TIMESTAMP`).
  - Create composite indexes:
    - `idx_sales_date_status (sale_date, status)`
    - `idx_sale_returns_date (return_date)`
    - `idx_stock_inventory_lot_location (product_lot_id, location)`
    - `idx_customer_ledger_customer_date (customer_id, created_at)`
- [x] **Step 2: Write `FlywayV3MigrationTest.java`** to verify clean migration execution on both H2 and PostgreSQL dialects.
- [x] **Step 3: Run `./gradlew test --tests *Flyway*`** and verify successful schema migration.

---

### Task 2: Domain Enums, Entity Hardening & Concurrency Mappings

**Files:**
- Create: `backend/src/main/java/com/alamin/pos/domain/enums/Location.java`
- Create: `backend/src/main/java/com/alamin/pos/domain/enums/SaleMode.java`
- Create: `backend/src/main/java/com/alamin/pos/domain/enums/PaymentMethod.java`
- Create: `backend/src/main/java/com/alamin/pos/domain/enums/TransactionType.java`
- Create: `backend/src/main/java/com/alamin/pos/domain/enums/MovementType.java`
- Create: `backend/src/main/java/com/alamin/pos/domain/enums/RefundType.java`
- Create: `backend/src/main/java/com/alamin/pos/domain/enums/CustomerType.java`
- Create: `backend/src/main/java/com/alamin/pos/domain/enums/QuarantineReason.java`
- Create: `backend/src/main/java/com/alamin/pos/entity/IdempotencyRecord.java`
- Modify: `backend/src/main/java/com/alamin/pos/entity/Product.java` (add `@Version private Long version;`)
- Modify: `backend/src/main/java/com/alamin/pos/entity/ProductLot.java` (add `@Version private Long version;`)
- Modify: `backend/src/main/java/com/alamin/pos/entity/StockInventory.java` (add `@Version private Long version;`, `quarantineQuantity`, `@Enumerated(EnumType.STRING) Location location`)
- Modify: `backend/src/main/java/com/alamin/pos/entity/Customer.java` (add `@Version private Long version;`)
- Modify: `backend/src/main/java/com/alamin/pos/entity/Sale.java` (add `@Version private Long version;`, `cashTendered`, `changeAmount`)
- Modify: `backend/src/main/java/com/alamin/pos/entity/CustomerLedger.java` (replace string transaction types with `TransactionType` enum)
- Modify: `backend/src/main/java/com/alamin/pos/entity/SaleReturn.java` (use `RefundType` enum)
- Create: `backend/src/main/java/com/alamin/pos/repository/IdempotencyRecordRepository.java`

**Interfaces:**
- Produces: Type-safe domain models, versioned entities, and repository interfaces.
- Consumes: Flyway V3 schema definitions.

- [x] **Step 1: Create all standard domain enums with string representation and helper conversion methods.**
- [x] **Step 2: Update existing JPA entities with `@Version`, `@Enumerated(EnumType.STRING)`, and new audit/quarantine fields.**
- [x] **Step 3: Create `IdempotencyRecord` entity and repository.**
- [x] **Step 4: Execute `./gradlew compileJava`** to verify all entity bindings and MapStruct mappers compile without errors.

---

### Task 3: Concurrency Engine & Atomic Document Sequencing

**Files:**
- Create: `backend/src/main/java/com/alamin/pos/service/DocumentSequenceService.java`
- Create: `backend/src/main/java/com/alamin/pos/service/impl/DocumentSequenceServiceImpl.java`
- Modify: `backend/src/main/java/com/alamin/pos/repository/StockInventoryRepository.java`
- Modify: `backend/src/main/java/com/alamin/pos/repository/CustomerRepository.java`
- Modify: `backend/src/main/java/com/alamin/pos/repository/ProductLotRepository.java`
- Modify: `backend/src/main/java/com/alamin/pos/service/impl/SaleServiceImpl.java`
- Modify: `backend/src/main/java/com/alamin/pos/service/impl/InventoryServiceImpl.java`
- Modify: `backend/src/main/java/com/alamin/pos/service/impl/SaleReturnServiceImpl.java`
- Test: `backend/src/test/java/com/alamin/pos/service/ConcurrencyLockingTest.java`

**Interfaces:**
- Produces: `DocumentSequenceService` producing collision-free invoice/return numbers; Pessimistic write locks on stock deduction and customer balances.
- Consumes: `invoice_number_seq`, `return_number_seq`, `transfer_number_seq`.

- [x] **Step 1: Implement `DocumentSequenceService`:**
  - Create methods `generateInvoiceNumber()`, `generateReturnNumber()`, and `generateTransferNumber()`.
  - Format: `INV-yyyyMMdd-XXXXXX` using database sequence `SELECT nextval('...')` (with H2/PostgreSQL compatibility fallback).
  - Guarantees strictly sequential, collision-free numbers without random guessing loops.
- [x] **Step 2: Add Pessimistic Locking to Repositories:**
  - In `StockInventoryRepository`:
    `@Lock(LockModeType.PESSIMISTIC_WRITE)`
    `@Query("SELECT s FROM StockInventory s WHERE s.productLot.id = :lotId AND s.location = :location")`
    `Optional<StockInventory> findByLotIdAndLocationForUpdate(@Param("lotId") Long lotId, @Param("location") String location);`
  - In `CustomerRepository`:
    `@Lock(LockModeType.PESSIMISTIC_WRITE)`
    `@Query("SELECT c FROM Customer c WHERE c.id = :id")`
    `Optional<Customer> findByIdForUpdate(@Param("id") Long id);`
- [x] **Step 3: Refactor `SaleServiceImpl.java` to use locked stock reads and sequence generation:**
  - Replace `ThreadLocalRandom` loop with `documentSequenceService.generateInvoiceNumber()`.
  - Acquire pessimistic lock on `StockInventory` before decrementing stock.
  - If customer has credit / due adjustment, acquire pessimistic lock on `Customer` before calculating and updating `currentDue` and appending ledger.
- [x] **Step 4: Refactor `InventoryServiceImpl.java` and `SaleReturnServiceImpl.java` to use pessimistic locking on stock mutations.**
- [x] **Step 5: Write `ConcurrencyLockingTest.java`** using `ExecutorService` and `CountDownLatch` with 10 concurrent threads deducting the same stock lot, asserting zero lost updates and serialized stock decrements.
- [x] **Step 6: Run `./gradlew test --tests *Concurrency*`** to verify concurrency guarantees.

---

### Task 4: Financial Math & Accounting Precision Engine

**Files:**
- Modify: `backend/src/main/java/com/alamin/pos/service/impl/SaleServiceImpl.java`
- Modify: `backend/src/main/java/com/alamin/pos/service/impl/SaleReturnServiceImpl.java`
- Modify: `backend/src/main/java/com/alamin/pos/service/impl/CustomerServiceImpl.java`
- Modify: `backend/src/main/java/com/alamin/pos/service/impl/DashboardServiceImpl.java`
- Test: `backend/src/test/java/com/alamin/pos/service/FinancialPrecisionTest.java`

**Interfaces:**
- Produces: GAAP-compliant gross and net profit, accurate cash drawer reconciliation, customer credit handling, and discount/round-off deduction.
- Consumes: Sales, Sale Returns, Customer Ledger entries.

- [x] **Step 1: Fix Profit and Discount Calculations in `SaleServiceImpl`:**
  - Ensure `roundOff` is subtracted from profit:
    `BigDecimal totalProfit = totalLineProfit.subtract(discount).subtract(roundOff);`
  - Enforce bounds: `discount` and `roundOff` cannot cause `totalAmount` to be negative.
  - Calculate change tendered:
    - If `cashTendered > cashPaid`, record `changeAmount = cashTendered - cashPaid`.
    - Validate `cashPaid + digitalPaid + dueAmount == totalAmount`.
- [x] **Step 2: Correct Cash Drawer and Financial Totals in `DashboardServiceImpl`:**
  - `cashInDrawerToday` must ONLY add `cashPaid` (net of change given to customer).
  - Net Sales = `Gross Sales - Gross Returns`.
  - Net Profit = `Gross Profit - Returned Goods Profit Adjustment`.
  - Update `DashboardSummaryResponse` to expose:
    - `grossSalesToday`, `salesReturnsToday`, `netSalesToday`
    - `grossProfitToday`, `netProfitToday`
    - `cashInDrawerToday` (segregated from digital collections)
- [x] **Step 3: Fix Customer Repayment and Ledger Accounting in `CustomerServiceImpl`:**
  - In `recordPayment()`: Validate payment amount > 0.
  - Classify transaction type accurately based on method (`bKash`/`Nagad` -> `MFS_PAYMENT`, `Bank` -> `BANK_TRANSFER`, `Cash` -> `CASH_PAYMENT`).
  - Support overpayment: If `paymentAmount > currentDue`, allow negative due (represented as `advanceCreditBalance`).
  - Atomically update `currentDue` under pessimistic row lock.
- [x] **Step 4: Fix `SaleReturnServiceImpl` Due Adjustment Handling:**
  - When `refundType == DUE_ADJUSTMENT`, if `refundAmount > customer.currentDue`, deduct `currentDue` to 0 and credit remainder as advance balance or refund cash.
- [x] **Step 5: Write `FinancialPrecisionTest.java`** verifying:
  - Sale with `subtotal = 500`, `discount = 20`, `roundOff = 5`, `purchaseCost = 400` yields `totalProfit = 75` (not 80).
  - Return of 1 item reduces today's reported net profit and net sales.
  - Paying 1000 Tk cash on 950 Tk invoice produces `cashPaid = 950`, `changeAmount = 50`, `cashInDrawer = 950` (not 1000).
- [x] **Step 6: Run `./gradlew test --tests *Financial*`**.

---

### Task 5: Agrochemical Regulatory Compliance & Strict Return Validation (Quarantine Held)

> **User Instruction:** Hold the quarantine inventory tracking part. Expired lot blocker, FEFO check, and strict invoice-linked return validations are active.

**Files:**
- Create: `backend/src/main/java/com/alamin/pos/exception/ExpiredLotSaleException.java`
- Create: `backend/src/main/java/com/alamin/pos/exception/InvalidReturnException.java`
- Modify: `backend/src/main/java/com/alamin/pos/service/impl/SaleServiceImpl.java`
- Modify: `backend/src/main/java/com/alamin/pos/service/impl/SaleReturnServiceImpl.java`
- Test: `backend/src/test/java/com/alamin/pos/service/AgrochemicalRegulatoryTest.java`

**Interfaces:**
- Produces: Compliance with Pesticide Ordinance 1971 (sale of expired chemical compounds prohibited); Strict invoice-linked return fraud prevention; Safe handling of damaged returns without corrupting active inventory.
- Consumes: `ProductLot`, `SaleItem`, `StockInventory`.

- [x] **Step 1: Implement Pesticide Expiry Blocker in `SaleServiceImpl`:**
  - Before confirming any sale line, check:
    ```java
    if (lot.getExpiryDate() != null && lot.getExpiryDate().isBefore(LocalDate.now())) {
        throw new ExpiredLotSaleException("Cannot sell expired lot " + lot.getLotNumber() + " (expired on " + lot.getExpiryDate() + "). Agrochemical regulatory violation.");
    }
    ```
- [x] **Step 2: Implement FEFO Validation & Audit in `SaleServiceImpl`:**
  - If cashier selects lot B, query whether lot A exists for the same product at the same location with `expiryDate < lotB.expiryDate` and `quantity > 0`.
  - If exists, record an audit entry in sale metadata or warning response indicating intentional FEFO bypass.
- [x] **Step 3: Implement Invoice-Linked Return Validation in `SaleReturnServiceImpl`:**
  - If `originalSaleId != null`:
    - Fetch the original `Sale` and its `SaleItem`s.
    - Verify that each returned item/lot was part of the original sale.
    - Calculate prior returns for this `saleId` and assert:
      `cumulativeReturnedQty + currentReturnQty <= originalSaleItemQty`.
    - If return price is omitted, enforce original invoice unit price.
- [x] **Step 4: Handle Damaged Returns without Corrupting Stock:**
  - In `SaleReturnServiceImpl`, if `isDamaged == true`:
    - Do NOT increment active salable `quantity` in `StockInventory`.
    - Route damaged returns into `QUARANTINE` stock location.
    - Record inventory movement with `MovementType.DAMAGED_RETURN_HOLD`.
    - (Full quarantine tracking and disposal completed in Task 12).
- [x] **Step 5: Write `AgrochemicalRegulatoryTest.java`** testing:
  - Attempting to sell an expired lot throws `ExpiredLotSaleException`.
  - Attempting to return 5 units on a 2-unit invoice throws `InvalidReturnException`.
  - Damaged returns do not increase salable stock.
- [x] **Step 6: Run `./gradlew test --tests *Agrochemical*`**.

---

### Task 6: Enterprise Security, Role-Based Access Control & Cost Masking

**Files:**
- Modify: `backend/build.gradle` (add `spring-boot-starter-security`, `io.jsonwebtoken:jjwt-api:0.12.6`, `jjwt-impl`, `jjwt-jackson`)
- Create: `backend/src/main/java/com/alamin/pos/security/Role.java` (`ROLE_CASHIER`, `ROLE_OWNER`)
- Create: `backend/src/main/java/com/alamin/pos/security/SecurityConfig.java`
- Create: `backend/src/main/java/com/alamin/pos/security/JwtTokenProvider.java`
- Create: `backend/src/main/java/com/alamin/pos/security/JwtAuthenticationFilter.java`
- Create: `backend/src/main/java/com/alamin/pos/dto/PinVerificationRequest.java`
- Create: `backend/src/main/java/com/alamin/pos/dto/AuthTokenResponse.java`
- Create: `backend/src/main/java/com/alamin/pos/controller/AuthController.java`
- Modify: `backend/src/main/java/com/alamin/pos/controller/DashboardController.java` (restrict profit analytics to `ROLE_OWNER`)
- Modify: `backend/src/main/java/com/alamin/pos/controller/BackupController.java` (restrict to `ROLE_OWNER`)
- Modify: `backend/src/main/java/com/alamin/pos/controller/ProductController.java` (restrict create/update to `ROLE_OWNER`)
- Modify: `backend/src/main/java/com/alamin/pos/dto/SaleResponse.java`, `StockItemResponse.java`, `ProductLotResponse.java` (cost masking via Jackson views or role checks)
- Test: `backend/src/test/java/com/alamin/pos/security/SecurityAccessControlTest.java`

**Interfaces:**
- Produces: Server-enforced authentication, JWT token generation, role verification, and protection of acquisition costs.
- Consumes: Owner PIN configuration (`app.security.owner-pin=1234` in `application.yml`).

- [x] **Step 1: Add Spring Security and JWT dependencies to `backend/build.gradle`.**
- [x] **Step 2: Implement `JwtTokenProvider` and `JwtAuthenticationFilter`:**
  - Secret key and expiration configurable via `application.yml`.
  - Issue JWT with claims `sub` ("pos-user") and `role` ("ROLE_CASHIER" or "ROLE_OWNER").
- [x] **Step 3: Implement `AuthController` (`POST /api/auth/verify-pin`):**
  - Accepts `PinVerificationRequest(pin)`.
  - Validates PIN against bcrypt-hashed or configured owner PIN.
  - Returns `AuthTokenResponse(token, role, expiresIn)`.
  - Provide fallback default cashier session token (`POST /api/auth/cashier-session`).
- [x] **Step 4: Configure `SecurityConfig.java`:**
  - Stateless session (`SessionCreationPolicy.STATELESS`).
  - CORS and CSRF configurations.
  - Authorize requests:
    - `/api/auth/**` -> `permitAll()`
    - `/api/backup/**` -> `hasRole('OWNER')`
    - `GET /api/dashboard/summary` -> `hasRole('OWNER')`
    - `POST /api/products`, `PUT /api/products/**` -> `hasRole('OWNER')`
    - `/api/sales/**`, `/api/inventory/**`, `/api/customers/**` -> `authenticated()`
- [x] **Step 5: Implement Acquisition Cost Masking:**
  - In response DTOs or service layers, mask `purchaseCost`, `unitCost`, and `profit` if caller does not possess `ROLE_OWNER`.
- [x] **Step 6: Write `SecurityAccessControlTest.java`** using `@WithMockUser`:
  - Verify Cashier token gets 403 Forbidden on `/api/dashboard/summary` and `/api/backup/download`.
  - Verify Owner token gets 200 OK with full analytics.
  - Verify unauthenticated requests receive 401 Unauthorized.
- [x] **Step 7: Run `./gradlew test --tests *Security*`**.

---

### Task 7: Resource Exhaustion & Denial of Service Protection

**Files:**
- Modify: `backend/src/main/java/com/alamin/pos/service/impl/BackupServiceImpl.java`
- Modify: `backend/src/main/java/com/alamin/pos/service/impl/BarcodeServiceImpl.java`
- Modify: `backend/src/main/java/com/alamin/pos/config/CorsConfig.java`
- Test: `backend/src/test/java/com/alamin/pos/service/DosProtectionTest.java`

**Interfaces:**
- Produces: Memory-safe database backup streaming (zero heap buffering) compatible with PostgreSQL and H2; Clamped barcode dimensions; Restricted CORS policy.

- [x] **Step 1: Refactor `BackupServiceImpl.java` for Streaming:**
  - Instead of buffering `List<String> scriptLines` into memory, implement a stream-based export using `StreamingResponseBody`.
  - For PostgreSQL: Stream table DDL and `COPY` statements or SQL `INSERT` statements using `ResultSet` cursors with fetch size 500.
  - For H2: Stream `SCRIPT` directly to output stream without intermediary `byte[]` creation.
  - Set HTTP headers: `Content-Disposition: attachment; filename="backup-*.sql"`, `Content-Type: application/sql`.
- [x] **Step 2: Secure `BarcodeServiceImpl.java` against Image Allocation DoS:**
  - Enforce bounds:
    `int validWidth = Math.max(100, Math.min(width, 1000));`
    `int validHeight = Math.max(30, Math.min(height, 300));`
  - Clamps or throws `IllegalArgumentException` if absurd dimensions (e.g. 50,000 px) are requested.
- [x] **Step 3: Harden `CorsConfig.java`:**
  - Restrict allowed origins to configured hosts (e.g. `localhost:3000`, `localhost:5173`, production domain) rather than permissive global wildcards when credentials are enabled.
- [x] **Step 4: Write `DosProtectionTest.java`** verifying:
  - Backup streaming executes without loading entire dataset into memory.
  - Requesting massive barcode dimensions (10,000 x 10,000) is safely clamped or rejected.
- [x] **Step 5: Run `./gradlew test --tests *Dos*`**.

---

### Task 8: Clean Architecture, N+1 Query Elimination & Pagination

**Files:**
- Modify: `backend/src/main/java/com/alamin/pos/service/impl/DashboardServiceImpl.java`
- Modify: `backend/src/main/java/com/alamin/pos/repository/SaleRepository.java`
- Modify: `backend/src/main/java/com/alamin/pos/repository/SaleReturnRepository.java`
- Modify: `backend/src/main/java/com/alamin/pos/repository/StockInventoryRepository.java`
- Modify: `backend/src/main/java/com/alamin/pos/controller/ProductController.java`
- Modify: `backend/src/main/java/com/alamin/pos/controller/CustomerController.java`
- Modify: `backend/src/main/java/com/alamin/pos/controller/InventoryController.java`
- Create: `backend/src/main/java/com/alamin/pos/dto/CustomerResponseDto.java`
- Create: `backend/src/main/java/com/alamin/pos/dto/CustomerLedgerEntryDto.java`
- Modify: `backend/src/main/java/com/alamin/pos/mapper/CustomerMapper.java`
- Test: `backend/src/test/java/com/alamin/pos/performance/DashboardQueryPerformanceTest.java`

**Interfaces:**
- Produces: Sub-50ms dashboard page loads via single aggregate queries; Paginated listing endpoints; Encapsulated customer DTO layer.

- [x] **Step 1: Eliminate $N+1$ Cascades in `DashboardServiceImpl`:**
  - In `SaleRepository`, add aggregate projections:
    ```java
    @Query("SELECT COALESCE(SUM(s.totalAmount), 0) FROM Sale s WHERE s.saleDate = :date AND s.status = 'COMPLETED'")
    BigDecimal sumTotalSalesOnDate(@Param("date") LocalDate date);

    @Query("SELECT COALESCE(SUM(s.totalProfit), 0) FROM Sale s WHERE s.saleDate = :date AND s.status = 'COMPLETED'")
    BigDecimal sumTotalProfitOnDate(@Param("date") LocalDate date);

    @Query("SELECT COALESCE(SUM(s.cashPaid), 0) FROM Sale s WHERE s.saleDate = :date AND s.status = 'COMPLETED'")
    BigDecimal sumCashPaidOnDate(@Param("date") LocalDate date);
    ```
  - In `SaleReturnRepository`, add return sum projections:
    ```java
    @Query("SELECT COALESCE(SUM(r.totalRefundAmount), 0) FROM SaleReturn r WHERE r.returnDate = :date")
    BigDecimal sumTotalReturnsOnDate(@Param("date") LocalDate date);
    ```
  - In `StockInventoryRepository`, add inventory summary query:
    ```java
    @Query("SELECT COUNT(DISTINCT s.productLot.product.id) FROM StockInventory s WHERE s.quantity <= s.productLot.product.lowStockThreshold")
    Long countLowStockProducts();
    ```
  - Replace in-memory looping in `DashboardServiceImpl` with these single-query methods.
- [x] **Step 2: Add Spring Data Pagination:**
  - `GET /api/products`: Accept `Pageable pageable`, return `Page<ProductResponse>`.
  - `GET /api/customers`: Accept `Pageable pageable`, return `Page<CustomerResponseDto>`.
  - `GET /api/inventory/stock`: Accept `Pageable pageable`, return `Page<StockItemResponse>`.
  - `GET /api/customers/{id}/ledger`: Accept `Pageable pageable`, return `Page<CustomerLedgerEntryDto>`.
- [x] **Step 3: Encapsulate `CustomerController` Entities:**
  - Replace raw `Customer` and `CustomerLedger` returns with `CustomerResponseDto` and `CustomerLedgerEntryDto`.
  - Update `CustomerMapper` with explicit mapping methods.
- [x] **Step 4: Write `DashboardQueryPerformanceTest.java`** asserting that dashboard generation executes in $\le 5$ database queries rather than thousands.
- [x] **Step 5: Run `./gradlew test --tests *Performance*`**.

---

### Task 9: Comprehensive Bean Validation & RFC 7807 Problem Details

**Files:**
- Modify: `backend/src/main/java/com/alamin/pos/dto/ProductDto.java`
- Modify: `backend/src/main/java/com/alamin/pos/dto/CustomerDto.java`
- Modify: `backend/src/main/java/com/alamin/pos/dto/SaleRequest.java`
- Modify: `backend/src/main/java/com/alamin/pos/dto/SaleItemRequest.java`
- Modify: `backend/src/main/java/com/alamin/pos/dto/ReturnRequest.java`
- Modify: `backend/src/main/java/com/alamin/pos/exception/GlobalExceptionHandler.java`
- Test: `backend/src/test/java/com/alamin/pos/validation/ValidationAndExceptionHandlingTest.java`

**Interfaces:**
- Produces: Strict input validation on all REST endpoints; Standard RFC 7807 Problem Details error responses.

- [x] **Step 1: Add Bean Validation Annotations to DTOs:**
  - `ProductDto`: `@NotBlank(message = "Product code is required")`, `@NotBlank(message = "Name is required")`, `@Positive(message = "Purchase cost must be positive")`, `@Positive(message = "MRP must be positive")`, `@Positive(message = "Carton size must be positive")`.
  - `CustomerDto`: `@NotBlank(message = "Customer name is required")`, `@Pattern(regexp = "^$|^01[3-9]\\d{8}$", message = "Invalid Bangladesh phone number")`.
  - `SaleRequest`: `@NotEmpty(message = "Cart cannot be empty")`, `@Valid` on line items, `@NotNull(message = "Payment method is required")`.
  - `SaleItemRequest`: `@NotNull`, `@Positive(message = "Quantity must be greater than zero")`, `@Positive(message = "Unit price must be greater than zero")`.
  - `ReturnRequest`: `@NotEmpty(message = "Returned items cannot be empty")`, `@Valid` on line items.
- [x] **Step 2: Update `GlobalExceptionHandler` to RFC 7807 (`ProblemDetail`):**
  - Implement handlers for:
    - `MethodArgumentNotValidException`: Map field errors into structured Problem Details `invalid-params`.
    - `OptimisticLockException` / `ObjectOptimisticLockingFailureException`: Return `409 Conflict` ("The record was updated by another cashier. Please refresh.").
    - `PessimisticLockException`: Return `423 Locked` or `503 Service Unavailable` ("Resource locked by active transaction, please retry").
    - `DataIntegrityViolationException`: Return `400 Bad Request` ("Database integrity constraint violation").
    - `ExpiredLotSaleException`: Return `422 Unprocessable Entity` ("Agrochemical compliance failure: lot expired").
    - `InvalidReturnException`: Return `400 Bad Request` ("Return exceeds invoiced purchase").
- [x] **Step 3: Write `ValidationAndExceptionHandlingTest.java`** verifying:
  - Submitting invalid phone numbers or blank product codes returns 400 with field errors.
  - Concurrent modification returns 409 Conflict with clear descriptive payload.
- [x] **Step 4: Run `./gradlew test --tests *Validation*`**.

---

### Task 9: Comprehensive Bean Validation & RFC 7807 Problem Details (Continued)

- [x] **Step 5: Ensure all exception tests pass across web layer.**

---

### Task 10: Transaction Idempotency Filter & Replay Prevention

**Files:**
- Create: `backend/src/main/java/com/alamin/pos/security/IdempotencyFilter.java`
- Modify: `backend/src/main/java/com/alamin/pos/security/SecurityConfig.java` (register filter)
- Test: `backend/src/test/java/com/alamin/pos/security/IdempotencyFilterTest.java`

**Interfaces:**
- Produces: Automatic replay deduplication on `POST /api/sales`, `POST /api/returns`, `POST /api/customers/*/payments` based on `X-Idempotency-Key` header.
- Consumes: `idempotency_records` table.

- [x] **Step 1: Implement `IdempotencyFilter`:**
  - Inspect incoming `POST` requests for `X-Idempotency-Key` header.
  - If header is absent, pass through normally.
  - If key exists:
    - Query `IdempotencyRecordRepository`.
    - If status is `COMPLETED`, immediately replay cached HTTP status and body without re-executing service logic.
    - If status is `IN_PROGRESS`, return `409 Conflict` ("Concurrent request with the same idempotency key is executing").
    - If key does not exist, insert row with `IN_PROGRESS`, wrap response in `ContentCachingResponseWrapper`, and on completion save HTTP code and body with status `COMPLETED`.
- [x] **Step 2: Register `IdempotencyFilter` in `SecurityConfig.java` before `UsernamePasswordAuthenticationFilter`.**
- [x] **Step 3: Write `IdempotencyFilterTest.java`** sending duplicate checkout requests with the same key, asserting that stock is deducted only ONCE and the second request returns the cached invoice response.
- [x] **Step 4: Run `./gradlew test --tests *Idempotency*`**.

---

### Task 11: End-to-End System Regression & Concurrency Stress Test Suite

**Files:**
- Create: `backend/src/test/java/com/alamin/pos/e2e/SystemConcurrencyStressTest.java`
- Create: `backend/src/test/java/com/alamin/pos/e2e/FullAccountingLedgerRegressionTest.java`
- Create: `backend/src/test/java/com/alamin/pos/e2e/SecurityRegressionTest.java`

**Interfaces:**
- Produces: Complete automated verification proving 100% resolution of all audit issues under high load.

- [x] **Step 1: Implement `SystemConcurrencyStressTest.java`:**
  - Set up an initial lot with 50 units.
  - Spawn 10 concurrent threads, each attempting to sell 10 units simultaneously.
  - Verify that exactly 5 transactions succeed and 5 fail with out-of-stock, ending stock is exactly 0.000, and no phantom inventory or negative stock occurs.
- [x] **Step 2: Implement `FullAccountingLedgerRegressionTest.java`:**
  - Execute complete sales lifecycle:
    1. Cash sale with round-off and discount.
    2. Partial credit sale to Customer A.
    3. Return of 1 item with due adjustment.
    4. Customer repayment via bKash.
    5. Check `DashboardSummaryResponse`: Verify net revenue, net profit, and cash drawer match physical reality to 2 decimal places.
- [x] **Step 3: Implement `SecurityRegressionTest.java`:**
  - Verify that Cashier role cannot view profit margins, unit costs, or trigger database backups.
  - Verify that Owner token allows all administrative functions.
- [x] **Step 4: Run `./gradlew check`** to ensure all unit, integration, and stress tests execute and pass with zero failures.

---

### Task 12: Quarantine Damaged Goods Inventory Tracking, Valuation & Disposal

**Files:**
- Modify: `backend/src/main/java/com/alamin/pos/model/Location.java` (add `QUARANTINE`)
- Modify: `backend/src/main/java/com/alamin/pos/repository/StockInventoryRepository.java` (exclude `QUARANTINE` from salable stock, add `findActiveQuarantineStocks`)
- Create: `backend/src/main/java/com/alamin/pos/dto/QuarantineStockResponse.java`
- Create: `backend/src/main/java/com/alamin/pos/dto/QuarantineDisposalRequest.java`
- Modify: `backend/src/main/java/com/alamin/pos/dto/StockItemResponse.java` (add `quarantineQuantity`)
- Modify: `backend/src/main/java/com/alamin/pos/service/SaleReturnServiceImpl.java` (route damaged returns to `QUARANTINE` stock with pessimistic locking)
- Modify: `backend/src/main/java/com/alamin/pos/service/InventoryService.java` & `InventoryServiceImpl.java` (implement quarantine valuation & disposal)
- Modify: `backend/src/main/java/com/alamin/pos/controller/InventoryController.java` (`GET /api/inventory/quarantine` & `POST /api/inventory/quarantine/dispose`)
- Test: `backend/src/test/java/com/alamin/pos/regulatory/AgrochemicalRegulatoryTest.java` & `SecurityRegressionTest.java`

**Interfaces:**
- Produces: `GET /api/inventory/quarantine` (with cashier cost masking) and `POST /api/inventory/quarantine/dispose` (restricted to `ROLE_OWNER`).
- Consumes: `stock_inventory` with `location = 'QUARANTINE'`, `godown_movement` with `DAMAGE_EXIT`.

- [x] **Step 1: Add `QUARANTINE` location to `Location` enum and isolate active salable stock queries.**
- [x] **Step 2: Update `SaleReturnServiceImpl` to route damaged return items to `QUARANTINE` location using pessimistic lock.**
- [x] **Step 3: Implement `getQuarantineStockOverview` and `disposeQuarantineStock` in `InventoryServiceImpl` with `DAMAGE_EXIT` movement logging.**
- [x] **Step 4: Expose `GET /api/inventory/quarantine` (with cashier cost masking) and `POST /api/inventory/quarantine/dispose` (restricted to `ROLE_OWNER`).**
- [x] **Step 5: Verify quarantine isolation, valuation, and disposal with regression and regulatory tests.**
