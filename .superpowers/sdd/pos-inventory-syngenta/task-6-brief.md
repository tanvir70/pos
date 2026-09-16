# Task 6 Brief: POS Sales Engine (Split-Stock, Negative Stock, Price Override, Round-off)

## Context & Objectives
You are the implementer for Task 6.
Your goal is to implement the central transactional POS sales engine in `SaleService` and `SaleController`.
The sales engine must handle the realities of a busy Bangladeshi agrochemical dealership:
1. **Split-Stock Deduction**: Allow deducting quantities from Dokan, Godown, or both for any line item.
2. **Negative Stock Allowance**: If Dokan physical stock is insufficient or 0, allow Dokan stock to go negative without failing the sale.
3. **Bargaining Price Override**: Line-item `unitPrice` can be manually overridden below or above standard catalog price.
4. **Frozen Cost Snapshot**: Capture `unitCost = lot.purchaseCost` on each `sale_item` to preserve exact historical profit even if lot costs fluctuate later.
5. **Discounts & Round-Off**: Support flat/percentage discounts and round-off (small change adjustment e.g. ৳3) so totals are clean.
6. **Multi-Payment Split**: Cash + Digital (bKash/Nagad/Bank, TrxID optional) + Due.
7. **Customer Due & Ledger**: Atomically update customer `currentDue` and insert `customer_ledger` audit row if there is a due balance.
8. **Godown Movement Audit**: If goods are dispatched from Godown, log `godown_movement` with `DIRECT_WHOLESALE_DISPATCH`.

## Strict Rules
- Ponytail engineering: Clean, transactional (`@Transactional`), zero unnecessary bloat.
- Zero assumptions: If any business or technical judgment is made, add `// BUSINESS DECISION:` directly in code and append a line to `DECISIONS_LOG.md`.
- No subagents contract: Do NOT invoke any subagents. You do all work directly.
- Decimal precision: All stock quantities MUST be `BigDecimal` with 3 decimals (`NUMERIC(12, 3)`). All money amounts MUST be `BigDecimal` with 2 decimals.

## Deliverables

### 1. DTOs (package `com.alamin.pos.dto`)
- `SaleItemRequest.java`:
  - `Long lotId` (required)
  - `BigDecimal totalQuantity` (required)
  - `BigDecimal dokanQuantity` (optional: if null and godownQuantity is null, default all to dokanQuantity)
  - `BigDecimal godownQuantity` (optional)
  - `BigDecimal unitPrice` (required: overridden or standard price)
- `SaleRequest.java`:
  - `Long customerId` (optional for walk-in retail)
  - `String saleMode` (required: 'RETAIL' or 'WHOLESALE')
  - `List<SaleItemRequest> items` (required, at least 1)
  - `BigDecimal discount` (optional, default 0)
  - `BigDecimal roundOff` (optional, default 0)
  - `String paymentMethod` (optional: 'CASH', 'BKASH', 'NAGAD', 'BANK_TRANSFER', 'DUE', 'SPLIT', default 'CASH')
  - `BigDecimal cashPaid` (optional, default 0)
  - `BigDecimal digitalPaid` (optional, default 0)
  - `String digitalMedium` (optional: 'BKASH', 'NAGAD', 'BANK_TRANSFER')
  - `String digitalTrxId` (optional)
  - `String cashierName` (optional)
- `SaleResponse.java`:
  - `Long id`, `String invoiceNo`, `LocalDateTime saleDate`
  - `String customerName`, `String customerPhone`
  - `String saleMode`
  - `BigDecimal subtotal`, `BigDecimal discount`, `BigDecimal roundOff`, `BigDecimal totalAmount`
  - `String paymentMethod`, `BigDecimal cashPaid`, `BigDecimal digitalPaid`, `BigDecimal dueAmount`
  - `BigDecimal totalProfit` (calculated from sum of `(unitPrice - unitCost) * totalQuantity - discount`)
  - `List<SaleItemResponse> items`

### 2. Service (`com.alamin.pos.service.SaleService`)
- `@Transactional SaleResponse processSale(SaleRequest request)`:
  - Generate unique invoice number: `INV-` + date + `-` + sequential/random 4 digits.
  - Calculate line items subtotal.
  - For each item:
    - Validate lot exists.
    - Resolve Dokan and Godown split quantities:
      - If `dokanQuantity == null && godownQuantity == null`, assign `dokanQuantity = totalQuantity`, `godownQuantity = 0`.
      - Validate `dokanQuantity.add(godownQuantity).compareTo(totalQuantity) == 0`.
    - Deduct Dokan stock: Find `StockInventory` for lot in 'DOKAN' (create if doesn't exist). Subtract `dokanQuantity`. **Negative quantity allowed** per domain rule!
    - Deduct Godown stock: If `godownQuantity > 0`, find `StockInventory` for lot in 'GODOWN'. Subtract `godownQuantity`. If godown stock is insufficient, throw `IllegalArgumentException("Insufficient Godown stock for lot " + lot.getLotNumber())`.
    - If `godownQuantity > 0`, log `GodownMovement` (`movementType = 'DIRECT_WHOLESALE_DISPATCH'`, `quantity = godownQuantity`, `referenceNo = invoiceNo`).
    - Freeze `unitCost = lot.getPurchaseCost()`.
    - Create `SaleItem` with snapshot values.
  - Compute invoice totals:
    - `subtotal = sum(item.subtotal)`
    - `totalAmount = subtotal - discount - roundOff`
    - `totalPaid = cashPaid + digitalPaid`
    - `dueAmount = max(0, totalAmount - totalPaid)`
  - Save `Sale`.
  - If `dueAmount > 0`:
    - Customer must be present; if customer is null, throw `IllegalArgumentException("Cannot have due amount for anonymous walk-in customer")`.
    - Check customer credit limit: If `customer.getCreditLimit() > 0` and `customer.getCurrentDue() + dueAmount > customer.getCreditLimit()`, log warning / decision (allow with warning).
    - Update `customer.currentDue = customer.currentDue + dueAmount`.
    - Insert `CustomerLedger` entry: `transactionType = 'INVOICE_BILL'`, `debit = dueAmount`, `balanceAfter = customer.getCurrentDue()`, `saleId = sale.getId()`.
  - Return `SaleResponse`.
- Query methods:
  - `SaleResponse getSaleById(Long id)`
  - `SaleResponse getSaleByInvoiceNo(String invoiceNo)`
  - `List<SaleResponse> getRecentSales(int limit)`

### 3. Controller (`com.alamin.pos.controller.SaleController`)
- `POST /api/sales` - Process sale invoice.
- `GET /api/sales/{id}` - Get sale details.
- `GET /api/sales/invoice/{invoiceNo}` - Get sale by invoice number.
- `GET /api/sales` - Get recent sales list.

### 4. Tests (`backend/src/test/java/com/alamin/pos/service/SaleServiceTest.java`)
Test cases:
1. **Split Deduction Test**: 4 from Dokan + 6 from Godown -> verifies Dokan stock reduced by 4, Godown stock reduced by 6, `godown_movement` logged.
2. **Negative Stock Test**: Dokan stock is 0, sell 5 from Dokan -> verifies Dokan stock becomes -5, sale succeeds without error.
3. **Bargaining Override & Round-Off**: Standard price 650 overridden to 620, round-off ৳20 -> verifies total amount and frozen unit cost accurately preserved.
4. **Gross Profit Test**: Exact gross profit calculated as `(unitPrice - unitCost) * qty - discount`.
5. **Multi-mode Payment with Due**: Split payment (Cash ৳500 + bKash ৳300 + Due ৳200) -> customer due incremented, customer ledger record created.
6. **Anonymous Due Validation**: Due sale without customer fails with `IllegalArgumentException`.

## Verification Command
Run in `backend/`:
`./gradlew test --tests SaleServiceTest`
Ensure it executes and passes with 0 failures.

## Reporting
- Commit changes: `feat: implement pos sales engine with split stock and negative inventory`
- Write report to: `.superpowers/sdd/pos-inventory-syngenta/task-6-report.md`
- Report back with DONE, commit hash, and test verification output.
