# Task 8 Brief: Dashboard & 1-Click Database Backup Engine

## Context & Objectives
You are the implementer for Task 8.
Your goal is to implement:
1. **Business Dashboard Analytics (`DashboardService`)**:
   - Aggregate sales today & this month.
   - Calculate exact gross profit today & this month based on frozen `unitCost` snapshots on `sale_item`.
   - Calculate live "Cash in Drawer" for today (`cash from sales + cash from due repayments - cash refunds`).
   - Calculate total market due across all customers.
   - Detect low stock alerts (total quantity across Dokan + Godown <= `minStockAlert`).
   - Detect expiry alerts (lots expiring within 30 days).
2. **1-Click Database Backup Engine (`BackupService`)**:
   - Provide instant database dump generation streaming a `.sql` file attachment (`syngenta-pos-backup-YYYYMMDD-HHmmss.sql`).
   - Uses native SQL `SCRIPT` query (in H2, `SCRIPT SIMPLE` or `SCRIPT` produces DDL + INSERT statements directly via JDBC without needing any external CLI tools), ensuring seamless 1-click download to USB flash drive or local disk.
3. **REST Controllers**:
   - `DashboardController`: `GET /api/dashboard/summary`
   - `BackupController`: `GET /api/backup/download`
4. **Integration Tests**:
   - `backend/src/test/java/com/alamin/pos/service/DashboardAndBackupTest.java`

## Strict Rules
- Ponytail engineering: Clean, lean, zero unnecessary bloat.
- Zero assumptions: If any business or technical judgment is made, add `// BUSINESS DECISION:` directly in code and append a line to `DECISIONS_LOG.md`.
- No subagents contract: Do NOT invoke any subagents. You do all work directly.
- Decimal precision: All monetary values MUST be `BigDecimal` with 2 decimals.

## Deliverables

### 1. DTOs (package `com.alamin.pos.dto`)
- `ExpiringLotDto.java`:
  - `Long lotId`, `String productCode`, `String productNameEn`, `String productNameBn`, `String lotNumber`, `LocalDate expiryDate`, `long daysUntilExpiry`, `BigDecimal dokanQuantity`, `BigDecimal godownQuantity`.
- `LowStockProductDto.java`:
  - `Long productId`, `String productCode`, `String nameEn`, `String nameBn`, `int minStockAlert`, `BigDecimal totalStock`.
- `DashboardSummaryDto.java`:
  - `BigDecimal totalSalesToday`
  - `BigDecimal totalSalesMonth`
  - `BigDecimal grossProfitToday`
  - `BigDecimal grossProfitMonth`
  - `BigDecimal cashInDrawerToday`
  - `BigDecimal totalMarketDue`
  - `long totalCustomers`
  - `long lowStockCount`
  - `long expiringSoonCount`
  - `List<ExpiringLotDto> expiringLots`
  - `List<LowStockProductDto> lowStockProducts`

### 2. Services (package `com.alamin.pos.service`)
- `DashboardService`:
  - `DashboardSummaryDto getSummary()`:
    - Queries sales between start of today and end of today.
    - Queries sales between start of month and end of today.
    - Calculates exact gross profit: sum of `(saleItem.unitPrice - saleItem.unitCost) * saleItem.totalQuantity` minus invoice discounts.
    - Computes cash in drawer:
      - `salesCash`: sum of `sale.cashPaid` today.
      - `repaymentsCash`: sum of `customer_ledger.credit` today where `transactionType = 'CASH_PAYMENT'`.
      - `refundsCash`: sum of `sale_return.totalRefundAmount` today where `refundType = 'CASH_REFUND'`.
      - `cashInDrawerToday = salesCash + repaymentsCash - refundsCash`.
    - Computes total market due: sum of `customer.currentDue` where `currentDue > 0`.
    - Expiring lots: lots where `expiryDate <= LocalDate.now().plusDays(30)`.
    - Low stock products: products where total stock (Dokan + Godown) <= `product.minStockAlert`.
- `BackupService`:
  - `byte[] exportSqlBackup()`:
    - Uses `JdbcTemplate` to run `SCRIPT` (H2 SQL script command) or generates clean SQL dump.
    - Returns bytes of the SQL script.
  - `String getBackupFileName()`:
    - Returns `syngenta-pos-backup-` + timestamp + `.sql`.

### 3. Controllers (package `com.alamin.pos.controller`)
- `DashboardController`:
  - `GET /api/dashboard/summary` - Returns `DashboardSummaryDto`.
- `BackupController`:
  - `GET /api/backup/download` - Streams the SQL dump as `application/sql` with `Content-Disposition: attachment; filename="..."`.

### 4. Tests (`backend/src/test/java/com/alamin/pos/service/DashboardAndBackupTest.java`)
Test cases:
1. **Dashboard Summary Metrics**:
   - Verify summary returns valid totals, non-null cash in drawer, market due, and customer count.
2. **Gross Profit Accuracy**:
   - Process a test sale with known unit price and frozen unit cost; verify `grossProfitToday` matches exact mathematical calculation.
3. **Cash in Drawer Calculation**:
   - Test cash sale + repayment - cash refund; verify drawer matches exact net cash.
4. **Expiry & Low Stock Alerts**:
   - Verify detection of lots expiring in < 30 days and products below min stock alert.
5. **Database Backup SQL Export**:
   - Execute `BackupService.exportSqlBackup()`; verify returned byte array is non-empty, contains SQL DDL/INSERT statements, and downloads with 200 OK via `BackupController`.

## Verification Command
Run in `backend/`:
`./gradlew test --tests DashboardAndBackupTest`
Ensure it compiles, executes, and passes with 0 failures.

## Reporting
- Commit changes: `feat: implement dashboard analytics and 1-click database backup engine`
- Write report to: `.superpowers/sdd/pos-inventory-syngenta/task-8-report.md`
- Report back with DONE, commit hash, and test verification output.
