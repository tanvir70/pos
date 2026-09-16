# Task 4 Brief: Inventory & Godown Lot Management Service (With Base Unit Conversion)

## Context & Objectives
You are the implementer for Task 4.
Your goal is to implement the core inventory management service, handling:
1. Incoming lot arrivals from Syngenta (with carton-to-base-unit conversion, entry date, purchase cost, and Godown stock allocation).
2. Godown-to-Dokan internal warehouse transfers with transactional stock updates and `godown_movement` audit logging.
3. Multi-location stock queries and FEFO active lot queries.
4. REST endpoints in `InventoryController` and comprehensive unit/integration tests in `InventoryServiceTest.java`.

## Strict Rules
- Ponytail engineering: Clean, lean, transactional (`@Transactional`), zero unnecessary bloat.
- Zero assumptions: If any business or technical judgment is made, add `// BUSINESS DECISION:` directly in code and append a line to `DECISIONS_LOG.md`.
- No subagents contract: Do NOT invoke any subagents. You do all work directly.
- Decimal precision: All stock quantities MUST be `BigDecimal` with 3 decimal places (`NUMERIC(12, 3)`). All prices/costs MUST be `BigDecimal` with 2 decimal places.

## Deliverables

### 1. DTOs (package `com.alamin.pos.dto`)
- `LotEntryRequest.java`:
  - `Long productId` (required)
  - `String lotNumber` (required)
  - `LocalDate entryDate` (defaults to current date if null)
  - `LocalDate expiryDate` (required)
  - `BigDecimal purchaseCost` (required)
  - `BigDecimal lotRetailPrice` (required)
  - `BigDecimal lotWholesalePrice` (required)
  - `String barcode` (optional: if blank, generate `SYN-<CODE>-<LOT>`)
  - `String supplierName` (optional, defaults to 'Syngenta Bangladesh Ltd.')
  - `String challanNo` (optional)
  - `BigDecimal quantityCartons` (optional, e.g. 5 cartons)
  - `BigDecimal quantityBaseUnits` (optional, e.g. 10 bottles)
  - `String location` (optional, defaults to 'GODOWN')
- `StockTransferRequest.java`:
  - `Long lotId` (required)
  - `String fromLocation` (required: 'GODOWN' or 'DOKAN')
  - `String toLocation` (required: 'DOKAN' or 'GODOWN')
  - `BigDecimal quantity` (required: quantity in base units)
  - `String remarks` (optional)
- `StockItemResponse.java` / `StockResponse.java`:
  - Product details (id, code, nameEn, nameBn, category, baseUnit, cartonMultiplier, defaultBarcode)
  - Lot details (id, lotNumber, entryDate, expiryDate, purchaseCost, lotRetailPrice, lotWholesalePrice, barcode)
  - Stock levels (`dokanQuantity`, `godownQuantity`, `totalQuantity`)

### 2. Service (`com.alamin.pos.service.InventoryService`)
- `@Transactional recordLotEntry(LotEntryRequest request)`:
  - Validates product exists.
  - Converts cartons to base units: `totalBaseUnits = (cartons * product.cartonMultiplier) + looseBaseUnits`. Must be > 0.
  - Generates barcode if blank.
  - Persists `InventoryLot`.
  - Upserts `StockInventory` for the lot in the given location (default `GODOWN`).
  - Logs `GodownMovement` (`movementType = 'PURCHASE_ENTRY'`, `quantity = totalBaseUnits`, `referenceNo = challanNo`).
  - Returns the created `InventoryLot`.
- `@Transactional transferStock(StockTransferRequest request)`:
  - Validates `fromLocation` != `toLocation`.
  - Validates transfer quantity > 0.
  - Retrieves source `StockInventory`. If source quantity < requested quantity, throws `IllegalArgumentException("Insufficient stock in " + fromLocation)`.
  - Decrements source `StockInventory`.
  - Retrieves or creates destination `StockInventory` and increments quantity.
  - Logs `GodownMovement` (`movementType = 'TRANSFER_TO_DOKAN'` or `'TRANSFER_TO_GODOWN'`, `quantity = request.getQuantity()`, `remarks = request.getRemarks()`).
- `List<StockItemResponse> getStockOverview()`:
  - Aggregates stock by product and lot with dokanQuantity, godownQuantity, and totalQuantity.
- `List<InventoryLotDto> getLotsByProduct(Long productId, boolean fefoOnly)`:
  - If `fefoOnly`, queries `findByProductIdOrderByExpiryDateAsc(productId)`.

### 3. Controller (`com.alamin.pos.controller.InventoryController`)
Exposes:
- `POST /api/inventory/lots` - Record new incoming lot arrival.
- `POST /api/inventory/transfer` - Transfer stock between Godown and Dokan.
- `GET /api/inventory/stock` - Current live stock across Dokan & Godown.
- `GET /api/inventory/lots` - List lots (supports `?productId=...` and `?fefo=true`).

### 4. Tests (`backend/src/test/java/com/alamin/pos/service/InventoryServiceTest.java`)
- Unit/Integration test:
  1. Record lot with 2 cartons where carton multiplier = 20 + 5 loose bottles -> verifies 45 base units credited to GODOWN, `godown_movement` audit row created.
  2. Stock transfer of 20 base units from GODOWN to DOKAN -> verifies GODOWN decreases to 25, DOKAN increases to 20, movement logged.
  3. Attempting to transfer more than available in GODOWN throws `IllegalArgumentException`.
  4. Query live stock overview -> verifies calculated totals.
  5. FEFO lot query ordering.

## Verification Command
Run in `backend/`:
`./gradlew test --tests InventoryServiceTest`
Ensure it compiles, executes, and passes with 0 failures.

## Reporting
- Commit changes: `feat: implement inventory and godown lot service with carton conversion`
- Write report to: `.superpowers/sdd/pos-inventory-syngenta/task-4-report.md`
- Report back with DONE, commit hash, and test verification output.
