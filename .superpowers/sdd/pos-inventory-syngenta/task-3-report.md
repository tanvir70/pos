# Task 3 Report: JPA Entities, Spring Data Repositories & MapStruct Mappers

**Status:** DONE  
**Commit Hash:** `883d06f` (`feat: add jpa entities, repositories and mapstruct mappers`)

## Summary of Deliverables

### 1. JPA Entities (package `com.alamin.pos.entity`)
Implemented all 10 domain entities matching the database schema and business constraints verbatim:
1. `Product.java`: Catalog master entity with dual English/Bengali names, unit definition, carton multiplier, prices, and stock alert threshold.
2. `InventoryLot.java`: Batch tracking entity with expiry dates, unit cost snapshot, and unique lot barcodes.
3. `StockInventory.java`: Dual-location stock balance per lot (`DOKAN` vs. `GODOWN`) with composite uniqueness constraint (`uq_lot_location`).
4. `GodownMovement.java`: Warehouse stock movements audit log (`PURCHASE_ENTRY`, `TRANSFER_TO_DOKAN`, `DIRECT_WHOLESALE_DISPATCH`, etc.).
5. `Customer.java`: Wholesale and retail customer profile entity with credit limit, current due, MFS, and bank account information.
6. `CustomerLedger.java`: Accounts receivable ledger (*Bakir Khata*) tracking debits, credits, running balances, money receipts, and optional `sale_id`.
7. `Sale.java`: Sales transaction invoice with split payment methods (cash, digital MFS, credit dues), and change round-off.
8. `SaleItem.java`: Itemized sale lines capturing split fulfillment quantities (`dokan_quantity`, `godown_quantity`) and frozen purchase cost snapshots.
9. `SaleReturn.java`: Sales return entity supporting customer returns with or without original invoice references.
10. `SaleReturnItem.java`: Return line items with damaged goods status (`is_damaged`) and restock routing destination.

### 2. Spring Data Repositories (package `com.alamin.pos.repository`)
Implemented all 10 repositories extending `JpaRepository<Entity, Long>`:
- `ProductRepository`:
  - `findByProductCode(String productCode)`
  - `findByDefaultBarcode(String defaultBarcode)`
  - `findByNameEnContainingIgnoreCaseOrNameBnContainingIgnoreCase(String nameEn, String nameBn)`
- `InventoryLotRepository`:
  - `findByBarcode(String barcode)`
  - `findByProductIdOrderByExpiryDateAsc(Long productId)` (**FEFO ordering**)
  - `findByProductId(Long productId)`
- `StockInventoryRepository`:
  - `findByLotIdAndLocation(Long lotId, String location)`
  - `findByLotId(Long lotId)`
- `GodownMovementRepository`:
  - `findByLotIdOrderByMovementDateDesc(Long lotId)`
- `CustomerRepository`:
  - `findByPhone(String phone)`
  - `findByNameContainingIgnoreCaseOrPhoneContaining(String name, String phone)`
  - `findByCustomerType(String customerType)`
- `CustomerLedgerRepository`:
  - `findByCustomerIdOrderByTransactionDateDesc(Long customerId)`
  - `findTopByCustomerIdOrderByTransactionDateDescIdDesc(Long customerId)`
- `SaleRepository`:
  - `findByInvoiceNo(String invoiceNo)`
  - `findByCustomerIdOrderBySaleDateDesc(Long customerId)`
- `SaleItemRepository`:
  - `findBySaleId(Long saleId)`
- `SaleReturnRepository`:
  - `findByReturnNo(String returnNo)`
- `SaleReturnItemRepository`:
  - `findBySaleReturnId(Long saleReturnId)`

### 3. DTOs & MapStruct Mappers (packages `com.alamin.pos.dto`, `com.alamin.pos.mapper`)
- Created clean transfer objects: `ProductDto`, `InventoryLotDto`, `CustomerDto`.
- Implemented MapStruct mappers with `@Mapper(componentModel = "spring")`:
  - `ProductMapper`: Entity <-> DTO conversions including collection mapping.
  - `InventoryLotMapper`: Flattened nested `Product` attributes (`productId`, `productCode`, `productNameEn`) with boundary safety (`@Mapping(target = "product", ignore = true)` on entity creation).
  - `CustomerMapper`: Clean profile data transfer.
- Validated seamless compilation with `lombok-mapstruct-binding:0.2.0`.

### 4. Integration Test (`backend/src/test/java/com/alamin/pos/repository/RepositoryTests.java`)
Implemented integration tests covering:
1. Product queries by product code, barcode, and Bengali/English fuzzy name search.
2. Inventory lot lookup and **FEFO** (First Expired, First Out) ordering (`LOT-2025B2` expiring 2027-12-31 dispatched before `LOT-2026A1` expiring 2028-06-30).
3. Stock inventory multi-location allocations (`DOKAN` shelf and `GODOWN` warehouse).
4. Godown movement audit log records.
5. Customer queries by phone, search terms, and customer type (`WHOLESALE` and `RETAIL`).
6. Customer ledger transaction history and latest running balance retrieval.
7. Sale and SaleItem persistence with cost snapshot verification.
8. SaleReturn and SaleReturnItem persistence with restock location routing.
9. MapStruct mapper injection and bidirectional conversion verification.

## Test Verification Output

Command:
```bash
./gradlew test --tests RepositoryTests
```

Output:
```
> Task :compileJava UP-TO-DATE
> Task :processResources UP-TO-DATE
> Task :classes UP-TO-DATE
> Task :compileTestJava
> Task :processTestResources NO-SOURCE
> Task :testClasses
> Task :test

BUILD SUCCESSFUL in 9s
4 actionable tasks: 2 executed, 2 up-to-date
```

JUnit XML Summary (`TEST-com.alamin.pos.repository.RepositoryTests.xml`):
```xml
<testsuite name="com.alamin.pos.repository.RepositoryTests" tests="9" skipped="0" failures="0" errors="0" time="0.521">
  <testcase name="Sale and SaleItem persistence and repository retrieval" classname="com.alamin.pos.repository.RepositoryTests" time="0.311"/>
  <testcase name="Product queries by code, default barcode, and bilingual name search" classname="com.alamin.pos.repository.RepositoryTests" time="0.033"/>
  <testcase name="InventoryLot query by barcode and FEFO (First Expired First Out) order" classname="com.alamin.pos.repository.RepositoryTests" time="0.031"/>
  <testcase name="CustomerLedger queries for transaction history and latest balance" classname="com.alamin.pos.repository.RepositoryTests" time="0.022"/>
  <testcase name="StockInventory queries for DOKAN and GODOWN allocations" classname="com.alamin.pos.repository.RepositoryTests" time="0.018"/>
  <testcase name="SaleReturn and SaleReturnItem persistence and repository retrieval" classname="com.alamin.pos.repository.RepositoryTests" time="0.033"/>
  <testcase name="MapStruct Mappers: ProductMapper, CustomerMapper, InventoryLotMapper verification" classname="com.alamin.pos.repository.RepositoryTests" time="0.021"/>
  <testcase name="Customer queries by phone, search and type" classname="com.alamin.pos.repository.RepositoryTests" time="0.024"/>
  <testcase name="GodownMovement query audit history by lot ID" classname="com.alamin.pos.repository.RepositoryTests" time="0.012"/>
</testsuite>
```
Total tests passed: 9 / 9 (100% pass rate, 0 failures, 0 errors, 0 skipped).

## Ready for Next Task
All JPA entities, Spring Data repositories, DTOs, MapStruct mappers, and integration tests are verified. Ready for Task 4: Inventory Lot & Godown Transfer Services.
