# Task 8 Report: Dashboard & 1-Click Database Backup Engine

**Status:** DONE  
**Commit Hash:** `0e9eb1b` (`feat: implement dashboard analytics and 1-click database backup engine`)  

---

## Summary of Deliverables

### 1. DTOs (`com.alamin.pos.dto`)
Implemented clean, decoupled data transfer objects with Lombok and standard decimal precision:
- `ExpiringLotDto`:
  - `Long lotId`: Primary key of the expiring inventory lot.
  - `String productCode`: Product SKU identifier.
  - `String productNameEn`: English trade name.
  - `String productNameBn`: Bengali trade name.
  - `String lotNumber`: Physical manufacturer batch/lot number.
  - `LocalDate expiryDate`: Date of lot expiration.
  - `long daysUntilExpiry`: Calculated days remaining until expiration (`ChronoUnit.DAYS.between(today, expiryDate)`).
  - `BigDecimal dokanQuantity`: Current stock in counter retail shop (`DOKAN`) with 3 decimals.
  - `BigDecimal godownQuantity`: Current stock in bulk warehouse (`GODOWN`) with 3 decimals.
- `LowStockProductDto`:
  - `Long productId`: Product primary key.
  - `String productCode`: Product SKU.
  - `String nameEn`: English trade name.
  - `String nameBn`: Bengali trade name.
  - `int minStockAlert`: Threshold triggering low stock alert.
  - `BigDecimal totalStock`: Total physical stock aggregated across all lots in Dokan and Godown.
- `DashboardSummaryDto`:
  - `BigDecimal totalSalesToday`: Aggregate billed invoice total for today (`scale = 2`).
  - `BigDecimal totalSalesMonth`: Aggregate billed invoice total from start of current month to today (`scale = 2`).
  - `BigDecimal grossProfitToday`: Exact gross margin for today based on frozen line item unit costs minus invoice discounts (`scale = 2`).
  - `BigDecimal grossProfitMonth`: Exact gross margin for current month (`scale = 2`).
  - `BigDecimal cashInDrawerToday`: Net live cash in register today (`salesCash + repaymentsCash - refundsCash`).
  - `BigDecimal totalMarketDue`: Total outstanding customer credit balance across all debtor accounts (`currentDue > 0`).
  - `long totalCustomers`: Total registered customer accounts.
  - `long lowStockCount`: Total products below or equal to `minStockAlert`.
  - `long expiringSoonCount`: Total lots expiring within 30 days.
  - `List<ExpiringLotDto> expiringLots`: Detail list of expiring lots sorted in FEFO order.
  - `List<LowStockProductDto> lowStockProducts`: Detail list of low stock items.

### 2. Service Layer (`com.alamin.pos.service`)
- `DashboardService`:
  - `getSummary()`:
    - **Sales Aggregation**: Queries sales between start of today and end of today, and start of month to end of today.
    - **Exact Gross Profit**: Iterates sale items for period sales, computing `sum((unitPrice - unitCost) * quantity) - discount` using frozen `sale_item.unit_cost` snapshots.
    - **Live Cash in Drawer**: Sums `sale.cashPaid` today + `customer_ledger.credit` today (`transactionType = 'CASH_PAYMENT'`) - `sale_return.totalRefundAmount` today (`refundType = 'CASH_REFUND'`).
    - **Total Market Due**: Sums positive `customer.currentDue` values across all customer accounts.
    - **Low Stock Scanner**: Evaluates total inventory across Dokan and Godown for every catalog item, flagging items where `totalStock <= minStockAlert`.
    - **Expiring Lot Scanner**: Identifies lots where `expiryDate <= LocalDate.now().plusDays(30)` in ascending FEFO order, populating days remaining and location stocks.
- `BackupService`:
  - `exportSqlBackup()`:
    - Executes native SQL `SCRIPT` query via Spring `JdbcTemplate` against H2 database.
    - Captures schema DDL (`CREATE TABLE`, indexes, constraints) and full table data (`INSERT INTO`) without any external operating system shell or CLI utilities (`mysqldump`, `pg_dump`).
    - Returns full UTF-8 byte stream.
  - `getBackupFileName()`:
    - Formats download filename as `syngenta-pos-backup-YYYYMMDD-HHmmss.sql`.

### 3. REST Controllers (`com.alamin.pos.controller`)
- `DashboardController` (`/api/dashboard`):
  - `GET /api/dashboard/summary`: Delivers complete `DashboardSummaryDto` metrics payload (HTTP 200 OK).
- `BackupController` (`/api/backup`):
  - `GET /api/backup/download`: Streams SQL backup file with headers:
    - `Content-Type: application/sql`
    - `Content-Disposition: attachment; filename="syngenta-pos-backup-YYYYMMDD-HHmmss.sql"`
    - `Content-Length: <length>`

### 4. Repository Enhancements
Extended Spring Data JPA repositories with lean, targeted queries:
- `SaleRepository.findBySaleDateBetween(LocalDateTime start, LocalDateTime end)`
- `SaleItemRepository.findBySaleIdIn(Collection<Long> saleIds)`
- `CustomerLedgerRepository.findByTransactionDateBetweenAndTransactionType(LocalDateTime start, LocalDateTime end, String transactionType)`
- `SaleReturnRepository.findByReturnDateBetweenAndRefundType(LocalDateTime start, LocalDateTime end, String refundType)`
- `InventoryLotRepository.findByExpiryDateLessThanEqualOrderByExpiryDateAsc(LocalDate expiryDate)`
- `StockInventoryRepository.sumQuantityByProductId(Long productId)`

### 5. Decisions Log Updates (`DECISIONS_LOG.md`)
Recorded 3 business and technical architecture decisions:
1. **Live Cash in Drawer Calculation**: Computes live net till cash for current operating day (`salesCash + repaymentsCash - refundsCash`), giving instant counter reconciliation before store closing.
2. **1-Click Database Backup Engine**: Employs native SQL `SCRIPT` via JDBC to produce portable, atomic SQL dumps directly to USB flash drives or local disk with zero external CLI dependencies.
3. **Expiring Lot Alert Threshold & Priority**: Flags lots expiring on or before `LocalDate.now().plusDays(30)` sorted by expiry date ascending (FEFO priority) to prevent inventory loss.

---

## Automated Test Suite (`com.alamin.pos.service.DashboardAndBackupTest`)

Executed 5 integration tests covering all requirements:
1. `testDashboardSummaryMetrics`:
   - Validated initial non-null sales metrics, cash in drawer, market due (৳15,000.00 from seed customer), and total customers count (>= 2).
   - Validated REST API endpoint `GET /api/dashboard/summary`.
2. `testGrossProfitAccuracy`:
   - Processed test sale for 2 units of Amistar Top (unitPrice ৳650.00, frozen unitCost ৳500.00, discount ৳50.00).
   - Expected gross profit delta: `2 * (650.00 - 500.00) - 50.00 = +৳250.00`.
   - Verified `grossProfitToday` and `grossProfitMonth` matched exact mathematical calculation down to the cent.
3. `testCashInDrawerCalculation`:
   - Performed cash sale (+৳1,000.00) + customer debt repayment (+৳500.00) - cash sales refund (-৳350.00).
   - Verified `cashInDrawerToday` incremented by exactly `+৳1,150.00`.
4. `testExpiryAndLowStockAlerts`:
   - Created product with 5 units stock and alert threshold 10; verified detection in `lowStockProducts` list and count.
   - Created lot expiring in 15 days (<= 30 days); verified detection in `expiringLots` list, `daysUntilExpiry == 15`, and stock split reporting.
5. `testDatabaseBackupSqlExport`:
   - Executed `backupService.exportSqlBackup()`; verified non-empty byte array containing valid DDL (`CREATE `) and DML (`INSERT INTO `) SQL statements.
   - Verified filename matches `syngenta-pos-backup-YYYYMMDD-HHmmss.sql`.
   - Verified HTTP `GET /api/backup/download` endpoint returns 200 OK with `application/sql` content type and attachment header.

---

## Verification Commands & Output

### 1. Focused Test Suite:
```bash
./gradlew test --tests DashboardAndBackupTest
```
Output:
```
BUILD SUCCESSFUL in 10s
4 actionable tasks: 2 executed, 2 up-to-date
Tests run: 5, Failures: 0, Errors: 0, Skipped: 0
```

### 2. Full Backend Test Suite:
```bash
./gradlew test
```
Output:
```
BUILD SUCCESSFUL in 11s
4 actionable tasks: 1 executed, 3 up-to-date
All 48 tests passing across entire backend suite (0 failures, 0 errors)
```
