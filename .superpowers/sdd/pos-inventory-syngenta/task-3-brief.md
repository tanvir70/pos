# Task 3 Brief: JPA Entities, Spring Data Repositories & MapStruct Mappers

## Context & Objectives
You are the implementer for Task 3.
Your goal is to build the complete JPA entity layer, Spring Data JPA repositories, core DTOs with MapStruct mappers, and comprehensive integration tests in `RepositoryTests.java`.

## Strict Rules
- Ponytail engineering: Clean, minimal, high performance, zero superfluous boilerplate.
- Zero assumptions: If any business or technical judgment is made, add `// BUSINESS DECISION:` directly in code and append a line to `DECISIONS_LOG.md`.
- No subagents contract: Do NOT invoke any subagents. You do all work directly.
- Compatibility & precision:
  - Match table/column names in `V1__init_syngenta_schema.sql` verbatim.
  - All stock quantities MUST be `BigDecimal` (stored as `NUMERIC(12, 3)`).
  - All monetary values MUST be `BigDecimal` (stored as `NUMERIC(12, 2)`).
  - Use `java.time.LocalDate` for `entry_date`, `expiry_date`.
  - Use `java.time.LocalDateTime` for timestamps.

## Deliverables

### 1. JPA Entities (package `com.alamin.pos.entity`)
- `Product.java`:
  - Fields: `id`, `productCode`, `nameEn`, `nameBn`, `companyName`, `category`, `baseUnit`, `cartonMultiplier` (BigDecimal), `defaultBarcode`, `standardRetailPrice` (BigDecimal), `standardWholesalePrice` (BigDecimal), `minStockAlert` (Integer), `imagePath`, `createdAt`.
- `InventoryLot.java`:
  - Fields: `id`, `product` (`@ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "product_id")`), `lotNumber`, `entryDate`, `expiryDate`, `purchaseCost` (BigDecimal), `lotRetailPrice` (BigDecimal), `lotWholesalePrice` (BigDecimal), `barcode`, `supplierName`, `challanNo`, `createdAt`.
- `StockInventory.java`:
  - Fields: `id`, `lot` (`@ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "lot_id")`), `location` (String: 'DOKAN', 'GODOWN'), `quantity` (BigDecimal).
- `GodownMovement.java`:
  - Fields: `id`, `lot` (`@ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "lot_id")`), `movementType`, `quantity` (BigDecimal), `movementDate`, `referenceNo`, `remarks`.
- `Customer.java`:
  - Fields: `id`, `name`, `fatherName`, `businessName`, `phone`, `whatsappNumber`, `email`, `villageAddress`, `customerType` ('WHOLESALE', 'RETAIL'), `creditLimit` (BigDecimal), `currentDue` (BigDecimal), `mfsType`, `mfsNumber`, `bankName`, `bankBranch`, `bankAccountNo`, `createdAt`.
- `CustomerLedger.java`:
  - Fields: `id`, `customer` (`@ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "customer_id")`), `transactionDate`, `transactionType`, `debit` (BigDecimal), `credit` (BigDecimal), `balanceAfter` (BigDecimal), `moneyReceiptNo`, `saleId`, `notes`.
- `Sale.java`:
  - Fields: `id`, `invoiceNo`, `saleDate`, `customer` (`@ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "customer_id")`), `saleMode`, `subtotal` (BigDecimal), `discount` (BigDecimal), `roundOff` (BigDecimal), `totalAmount` (BigDecimal), `paymentMethod`, `cashPaid` (BigDecimal), `digitalPaid` (BigDecimal), `digitalMedium`, `digitalTrxId`, `dueAmount` (BigDecimal), `cashierName`.
- `SaleItem.java`:
  - Fields: `id`, `sale` (`@ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "sale_id")`), `lot` (`@ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "lot_id")`), `totalQuantity` (BigDecimal), `dokanQuantity` (BigDecimal), `godownQuantity` (BigDecimal), `unitPrice` (BigDecimal), `unitCost` (BigDecimal), `subtotal` (BigDecimal).
- `SaleReturn.java`:
  - Fields: `id`, `returnNo`, `originalSale` (`@ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "original_sale_id")`), `customer` (`@ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "customer_id")`), `returnDate`, `totalRefundAmount` (BigDecimal), `refundType`, `reason`.
- `SaleReturnItem.java`:
  - Fields: `id`, `saleReturn` (`@ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "sale_return_id")`), `lot` (`@ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "lot_id")`), `quantity` (BigDecimal), `refundPrice` (BigDecimal), `isDamaged` (Boolean), `restockLocation`.

### 2. Spring Data Repositories (package `com.alamin.pos.repository`)
- `ProductRepository`:
  - `Optional<Product> findByProductCode(String productCode)`
  - `Optional<Product> findByDefaultBarcode(String defaultBarcode)`
  - `List<Product> findByNameEnContainingIgnoreCaseOrNameBnContainingIgnoreCase(String nameEn, String nameBn)`
- `InventoryLotRepository`:
  - `Optional<InventoryLot> findByBarcode(String barcode)`
  - `List<InventoryLot> findByProductIdOrderByExpiryDateAsc(Long productId)` (FEFO order!)
  - `List<InventoryLot> findByProductId(Long productId)`
- `StockInventoryRepository`:
  - `Optional<StockInventory> findByLotIdAndLocation(Long lotId, String location)`
  - `List<StockInventory> findByLotId(Long lotId)`
- `GodownMovementRepository`:
  - `List<GodownMovement> findByLotIdOrderByMovementDateDesc(Long lotId)`
- `CustomerRepository`:
  - `Optional<Customer> findByPhone(String phone)`
  - `List<Customer> findByNameContainingIgnoreCaseOrPhoneContaining(String name, String phone)`
  - `List<Customer> findByCustomerType(String customerType)`
- `CustomerLedgerRepository`:
  - `List<CustomerLedger> findByCustomerIdOrderByTransactionDateDesc(Long customerId)`
  - `Optional<CustomerLedger> findTopByCustomerIdOrderByTransactionDateDescIdDesc(Long customerId)`
- `SaleRepository`:
  - `Optional<Sale> findByInvoiceNo(String invoiceNo)`
  - `List<Sale> findByCustomerIdOrderBySaleDateDesc(Long customerId)`
- `SaleItemRepository`:
  - `List<SaleItem> findBySaleId(Long saleId)`
- `SaleReturnRepository`:
  - `Optional<SaleReturn> findByReturnNo(String returnNo)`
- `SaleReturnItemRepository`:
  - `List<SaleReturnItem> findBySaleReturnId(Long saleReturnId)`

### 3. DTOs & MapStruct Mappers (packages `com.alamin.pos.dto`, `com.alamin.pos.mapper`)
- Create DTOs: `ProductDto`, `InventoryLotDto`, `CustomerDto`
- Create MapStruct mappers: `ProductMapper`, `InventoryLotMapper`, `CustomerMapper` (`@Mapper(componentModel = "spring")`)
- Verify Lombok and MapStruct work harmoniously using the configured `lombok-mapstruct-binding`.

### 4. Integration Test (`backend/src/test/java/com/alamin/pos/repository/RepositoryTests.java`)
- Test reading seed data:
  - Product repository queries by code and name.
  - InventoryLot repository query by barcode and FEFO sorting (`findByProductIdOrderByExpiryDateAsc`).
  - StockInventory query for DOKAN and GODOWN allocations.
  - Customer repository query by phone.
  - Mapper injection & mapping verification (`ProductMapper`, `CustomerMapper`, `InventoryLotMapper`).

## Verification Command
Run in `backend/`:
`./gradlew test --tests RepositoryTests`
Ensure it compiles with Lombok + MapStruct, executes, and passes with 0 errors.

## Reporting
- Commit changes: `feat: add jpa entities, repositories and mapstruct mappers`
- Write report to: `.superpowers/sdd/pos-inventory-syngenta/task-3-report.md`
- Report back with DONE, commit hash, and test verification output.
