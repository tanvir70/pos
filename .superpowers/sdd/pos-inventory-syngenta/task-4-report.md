# Task 4 Report: Inventory & Godown Lot Management Service (With Base Unit Conversion)

**Status:** DONE  
**Commit Hash:** `704d027` (`feat: implement inventory and godown lot service with carton conversion`)

## Summary of Deliverables

### 1. Data Transfer Objects (package `com.alamin.pos.dto`)
Implemented clean transfer objects aligned with domain and API requirements:
- `LotEntryRequest.java`:
  - `productId`, `lotNumber`, `entryDate`, `expiryDate`
  - `purchaseCost`, `lotRetailPrice`, `lotWholesalePrice`
  - `barcode`, `supplierName`, `challanNo`
  - `quantityCartons`, `quantityBaseUnits`, `location`
  - Jakarta validation constraints (`@NotNull`, `@NotBlank`)
- `StockTransferRequest.java`:
  - `lotId`, `fromLocation`, `toLocation`, `quantity`, `remarks`
  - Validation constraints enforcing required transfer coordinates
- `StockItemResponse.java`:
  - Complete product metadata (`productId`, `productCode`, `productNameEn`, `productNameBn`, `category`, `baseUnit`, `cartonMultiplier`, `defaultBarcode`)
  - Batch lot metadata (`lotId`, `lotNumber`, `entryDate`, `expiryDate`, `purchaseCost`, `lotRetailPrice`, `lotWholesalePrice`, `barcode`)
  - Aggregated multi-location balances (`dokanQuantity`, `godownQuantity`, `totalQuantity`)

### 2. Spring Data Repository Enhancement (`com.alamin.pos.repository`)
- `InventoryLotRepository.java`:
  - Added `findAllByOrderByExpiryDateAsc()` to support global FEFO ordering across the entire catalog in addition to single-product FEFO queries (`findByProductIdOrderByExpiryDateAsc`).

### 3. Core Inventory Service (`com.alamin.pos.service.InventoryService`)
Implemented `@Service` with `@Transactional` demarcations and domain business rules:
- `recordLotEntry(LotEntryRequest request)`:
  - Validates product existence via `ProductRepository`.
  - Converts carton quantities to base units: `totalBaseUnits = (cartons * product.cartonMultiplier) + looseBaseUnits` with `NUMERIC(12, 3)` precision (`RoundingMode.HALF_UP`).
  - Auto-synthesizes unique barcode `SYN-<CODE>-<LOT>` when barcode is not explicitly provided.
  - Persists `InventoryLot` with scaled costs and prices.
  - Upserts `StockInventory` for the designated location (default `GODOWN`).
  - Records immutable `GodownMovement` audit entry (`PURCHASE_ENTRY`) with challan reference and unit breakdown.
- `transferStock(StockTransferRequest request)`:
  - Validates that `fromLocation` and `toLocation` differ, and transfer quantity is strictly positive.
  - Validates source stock and throws `IllegalArgumentException("Insufficient stock in " + fromLocation)` if requested quantity exceeds available balance.
  - Decrements source `StockInventory` and increments destination `StockInventory` atomically.
  - Records `GodownMovement` audit log (`TRANSFER_TO_DOKAN` or `TRANSFER_TO_GODOWN`).
- `getStockOverview()`:
  - Aggregates multi-location stock per product and lot, calculating `dokanQuantity`, `godownQuantity`, and `totalQuantity` with zero-default safety.
- `getLotsByProduct(Long productId, boolean fefoOnly)`:
  - Dispatches product-specific or catalog-wide lot queries with FEFO expiry sorting.

### 4. REST Controller (`com.alamin.pos.controller.InventoryController`)
Exposed RESTful endpoints with `@CrossOrigin` support:
- `POST /api/inventory/lots` - Record new incoming shipment lot arrival (`HttpStatus.CREATED`).
- `POST /api/inventory/transfer` - Transfer stock between Godown and Dokan.
- `GET /api/inventory/stock` - Current live stock overview across Dokan & Godown.
- `GET /api/inventory/lots` - List lots with query parameters (`?productId=...` and `?fefo=true`).

### 5. Automated Tests (`backend/src/test/java/com/alamin/pos/service/InventoryServiceTest.java`)
Implemented 6 integration tests verifying:
1. `testRecordLotWithCartonConversion`: 2 cartons (multiplier 20) + 5 loose bottles -> verifies 45 base units credited to GODOWN, barcode synthesis (`SYN-AMI-TOP-LOT-2026-TEST45`), and `PURCHASE_ENTRY` movement audit record.
2. `testStockTransferGodownToDokan`: Transfer of 20 base units from GODOWN to DOKAN decreases GODOWN from 45 to 25 and increases DOKAN to 20, creating `TRANSFER_TO_DOKAN` movement.
3. `testTransferMoreThanAvailableStockThrowsException`: Attempting to transfer 30 base units when GODOWN has 25 throws `IllegalArgumentException` with `"Insufficient stock in GODOWN"`.
4. `testGetStockOverviewCalculatesTotals`: Verifies live multi-location stock calculation `totalQuantity == dokanQuantity + godownQuantity` and matches seeded inventory data.
5. `testFefoLotOrdering`: Verifies chronological ascending ordering by `expiryDate` where `LOT-2025B2` (expiring 2027-12-31) precedes `LOT-2026A1` (expiring 2028-06-30).
6. `testValidationEdgeCases`: Verifies rejection of zero-quantity lot entry, identical transfer coordinates, and non-positive transfer quantities.

---

## Test Verification Output

Command:
```bash
./gradlew test --tests InventoryServiceTest
```

Output:
```
> Task :compileJava
> Task :processResources UP-TO-DATE
> Task :classes
> Task :compileTestJava
> Task :processTestResources NO-SOURCE
> Task :testClasses
> Task :test

BUILD SUCCESSFUL in 9s
4 actionable tasks: 3 executed, 1 up-to-date
```

JUnit XML Summary (`TEST-com.alamin.pos.service.InventoryServiceTest.xml`):
```xml
<testsuite name="com.alamin.pos.service.InventoryServiceTest" tests="6" skipped="0" failures="0" errors="0" time="1.035">
  <testcase name="5. FEFO lot query orders lots strictly by expiryDate ascending" classname="com.alamin.pos.service.InventoryServiceTest" time="0.79"/>
  <testcase name="1. Record lot with 2 cartons (multiplier 20) + 5 loose bottles credits 45 base units to GODOWN and logs movement" classname="com.alamin.pos.service.InventoryServiceTest" time="0.062"/>
  <testcase name="4. Query live stock overview verifies calculated totals across locations" classname="com.alamin.pos.service.InventoryServiceTest" time="0.081"/>
  <testcase name="Validation edge cases: identical transfer locations, negative quantity, zero base units" classname="com.alamin.pos.service.InventoryServiceTest" time="0.02"/>
  <testcase name="3. Attempting to transfer more than available stock in GODOWN throws IllegalArgumentException" classname="com.alamin.pos.service.InventoryServiceTest" time="0.023"/>
  <testcase name="2. Stock transfer of 20 base units from GODOWN to DOKAN decreases GODOWN to 25 and increases DOKAN to 20" classname="com.alamin.pos.service.InventoryServiceTest" time="0.05"/>
</testsuite>
```

Full Test Suite Run:
```bash
./gradlew test
BUILD SUCCESSFUL in 9s (17/17 tests passing across entire repository)
```

## Ready for Next Task
Inventory service, carton conversion math, Godown-to-Dokan transfers, FEFO dispatch queries, and movement audit logs are fully verified. Ready for Task 5 / Task 6: Sales Engine & Checkout Flow.
