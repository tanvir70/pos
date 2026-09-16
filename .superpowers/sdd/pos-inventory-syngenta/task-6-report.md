# Task 6 Report: POS Sales Engine (Split-Stock, Negative Stock, Price Override, Round-off)

**Status:** DONE  
**Commit Hash:** `8b01473` (`feat: implement pos sales engine with split stock and negative inventory`)  

---

## Summary of Deliverables

### 1. DTOs (`com.alamin.pos.dto`)
Implemented request and response data transfer objects with Jakarta Bean Validation and decimal precision enforcement:
- `SaleItemRequest`:
  - `lotId` (`Long`, `@NotNull`): Identification of the specific inventory lot.
  - `totalQuantity` (`BigDecimal`, `@NotNull`, min `0.001`): Aggregate quantity requested.
  - `dokanQuantity` (`BigDecimal`): Optional split quantity to deduct from Dokan counter.
  - `godownQuantity` (`BigDecimal`): Optional split quantity to deduct from Godown warehouse.
  - `unitPrice` (`BigDecimal`, `@NotNull`): Overridden or standard selling price per base unit.
- `SaleRequest`:
  - `customerId` (`Long`): Optional reference to customer (null for walk-in retail).
  - `saleMode` (`String`, `@NotBlank`): 'RETAIL' or 'WHOLESALE'.
  - `items` (`List<SaleItemRequest>`, `@NotEmpty`, `@Valid`): Line items for invoice.
  - `discount` (`BigDecimal`, default `0.00`): Flat invoice discount.
  - `roundOff` (`BigDecimal`, default `0.00`): Round-off adjustment to eliminate small change (e.g. ৳3, ৳20).
  - `paymentMethod` (`String`, default `'CASH'`): 'CASH', 'BKASH', 'NAGAD', 'BANK_TRANSFER', 'DUE', 'SPLIT'.
  - `cashPaid` (`BigDecimal`, default `0.00`): Cash collected.
  - `digitalPaid` (`BigDecimal`, default `0.00`): Digital payment collected.
  - `digitalMedium` (`String`), `digitalTrxId` (`String`): MFS/Bank channel and reference transaction ID.
  - `cashierName` (`String`): Active operator name.
- `SaleItemResponse`:
  - Enriched with lot metadata (`lotId`, `lotNumber`, `barcode`, `productNameEn`, `productNameBn`), split fulfillment quantities, unit price, snapshot frozen unit cost, line subtotal, and line profit.
- `SaleResponse`:
  - Complete invoice header and summary with invoice number, date, customer info, totals (`subtotal`, `discount`, `roundOff`, `totalAmount`), payment breakup (`cashPaid`, `digitalPaid`, `dueAmount`), gross profit calculation, and item response list.

### 2. Service Layer (`com.alamin.pos.service.SaleService`)
Transactional sales processing engine adhering to domain realities in Bangladeshi agrochemical dealerships:
- `processSale(SaleRequest request)`:
  - **Invoice Generation**: Formats unique invoice number `INV-YYYYMMDD-XXXX` with 4 random digits and database uniqueness check.
  - **Split Deduction & Auto-Balancing**: If split quantities are unspecified, allocates 100% to Dokan. If partially specified, auto-balances the remainder. Validates `dokanQuantity + godownQuantity == totalQuantity`.
  - **Asymmetric Negative Stock**: Dokan counter stock is allowed to go negative without halting transactions, supporting rush counter sales of newly arrived shipments before supplier challan entry.
  - **Strict Godown Validation**: Godown bulk inventory strictly checks available stock and blocks negative stock, protecting bulk warehouse physical audit integrity.
  - **Godown Movement Audit**: Logs `DIRECT_WHOLESALE_DISPATCH` in `godown_movement` for any quantities dispatched directly from Godown warehouse.
  - **Frozen Cost Snapshot**: Captures `unitCost = lot.getPurchaseCost()` on `SaleItem` to permanently preserve margin accuracy regardless of future supplier price revisions.
  - **Discount & Round-Off Totals**:
    - `totalAmount = subtotal - discount - roundOff`
    - `dueAmount = max(0, totalAmount - (cashPaid + digitalPaid))`
  - **Customer Credit & Ledger**:
    - If `dueAmount > 0`, enforces customer presence (rejecting anonymous walk-ins with `IllegalArgumentException`).
    - Checks customer credit limit; logs warning if exceeded while allowing transaction to proceed per rural agro dealership practice.
    - Atomically increments `customer.currentDue` by `dueAmount`.
    - Creates immutable audit record in `customer_ledger` (`transactionType = 'INVOICE_BILL'`, `debit = dueAmount`, `balanceAfter = currentDue`, `saleId = sale.getId()`).
  - **Gross Profit**:
    - Calculates `totalProfit = sum((unitPrice - unitCost) * totalQuantity) - discount`.
- Query Methods:
  - `getSaleById(Long id)`: Retrieves sale by primary key.
  - `getSaleByInvoiceNo(String invoiceNo)`: Retrieves sale by human-readable invoice number.
  - `getRecentSales(int limit)`: Retrieves recent sales ordered by sale date descending with pageable limit.

### 3. REST Controller (`com.alamin.pos.controller.SaleController`)
Exposes endpoints with `@CrossOrigin` support:
- `POST /api/sales`: Processes and records a new sales invoice (HTTP 201 CREATED).
- `GET /api/sales/{id}`: Fetches sale details by ID (HTTP 200 OK).
- `GET /api/sales/invoice/{invoiceNo}`: Fetches sale details by invoice number (HTTP 200 OK).
- `GET /api/sales`: Fetches recent sales list with optional `limit` parameter (default 50).

### 4. Decisions Log Updates (`DECISIONS_LOG.md`)
Appended 7 business and technical decisions:
1. **Invoice Number Formatting**: `INV-YYYYMMDD-XXXX` format with uniqueness verification loop.
2. **Split Deduction Allocation Defaults**: Auto-defaults to Dokan counter stock when split parameters are omitted.
3. **Asymmetric Negative Stock Allowance**: Dokan stock allows negative inventory; Godown bulk storage strictly prevents negative counts.
4. **Godown Movement Wholesale Audit**: Immutable `DIRECT_WHOLESALE_DISPATCH` records logged for Godown dispatches.
5. **Transactional Unit Cost Snapshot**: Snapshot of `lot.purchaseCost` frozen into `sale_item.unit_cost`.
6. **Invoice-Level Round-Off Deduction**: Direct invoice total adjustment avoiding catalog cost skew.
7. **Soft Credit Ceiling Enforcement**: Credit limits log operational warnings rather than aborting customer sales.

---

## Automated Test Suite (`com.alamin.pos.service.SaleServiceTest`)

Executed 8 tests covering all 6 required brief scenarios plus boundary edge cases:
1. `testSplitStockDeduction`: 4 from Dokan + 6 from Godown -> Dokan reduced from 10 to 6, Godown reduced from 30 to 24, `DIRECT_WHOLESALE_DISPATCH` movement logged with matching invoice number.
2. `testNegativeStockAllowedInDokan`: Starting with 0 Dokan stock, sells 5 base units -> Dokan stock decrements to `-5.000` and sale succeeds without failure.
3. `testPriceOverrideAndRoundOff`: Standard price 650 overridden to 620, round-off ৳20 -> subtotal ৳1240, round-off ৳20, total amount ৳1220; frozen unit cost ৳500 accurately captured.
4. `testGrossProfitCalculation`: Price 620, cost 500, qty 2 (margin 240), discount 40 -> exact gross profit verified at ৳200.00.
5. `testMultiPaymentWithDue`: Split payment (Cash ৳500 + bKash ৳300 + Due ৳200) -> customer due updated from ৳15000 to ৳15200, `customer_ledger` created with `INVOICE_BILL`, `debit = 200.00`, `balanceAfter = 15200.00`.
6. `testAnonymousCustomerWithDueThrowsException`: Anonymous walk-in attempting credit sale throws `IllegalArgumentException("Cannot have due amount for anonymous walk-in customer")`.
7. `testInsufficientGodownStockThrowsException`: Requesting Godown quantity exceeding warehouse stock throws `IllegalArgumentException("Insufficient Godown stock for lot ...")`.
8. `testQuerySaleMethods`: Verifies `getSaleById`, `getSaleByInvoiceNo`, and `getRecentSales` queries.

---

## Verification Commands & Output

### 1. Focused Test Suite:
```bash
./gradlew test --tests SaleServiceTest
```
Output:
```
BUILD SUCCESSFUL in 9s
4 actionable tasks: 1 executed, 3 up-to-date
Tests run: 8, Failures: 0, Errors: 0, Skipped: 0
```

### 2. Full Backend Test Suite:
```bash
./gradlew test
```
Output:
```
BUILD SUCCESSFUL in 10s
4 actionable tasks: 1 executed, 3 up-to-date
All 35 tests passing across entire backend suite (0 failures, 0 errors)
```
