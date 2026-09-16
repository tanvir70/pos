# Task 7 Brief: Customer Due Ledger & Direct Returns

## Context & Objectives
You are the implementer for Task 7.
Your goal is to implement:
1. **Customer Management & Due Repayment**:
   - Creating/updating wholesale and retail customer profiles with full fields (proprietor name, father's name, business name, WhatsApp, phone, MFS, bank details, credit limit, current due).
   - Cash due repayment (`POST /api/customers/{id}/payments`) updating `currentDue` and creating `customer_ledger` entries with `money_receipt_no` (MR No.) and `CASH_PAYMENT`.
   - Customer ledger statement retrieval.
2. **Sales Returns (With or Without Invoice)**:
   - Direct return support where `originalSaleId` is null (common in rural agro-dealers where farmers return unopened pesticides or defective containers without receipts).
   - Return restock routing: Sellable items return to Dokan or Godown stock (with `godown_movement` logging if restocked to Godown).
   - Damaged item routing: Damaged items (`isDamaged = true`) are quarantined and NOT added to sellable stock.
   - Refund mechanisms: `CASH_REFUND` (cash payout) vs `DUE_ADJUSTMENT` (credits customer ledger with `RETURN_CREDIT` and reduces due).
3. **Controllers & Integration Tests**:
   - `CustomerController` and `SaleReturnController`.
   - Tests in `backend/src/test/java/com/alamin/pos/service/CustomerAndReturnTest.java`.

## Strict Rules
- Ponytail engineering: Clean, transactional (`@Transactional`), zero unnecessary bloat.
- Zero assumptions: If any business or technical judgment is made, add `// BUSINESS DECISION:` directly in code and append a line to `DECISIONS_LOG.md`.
- No subagents contract: Do NOT invoke any subagents. You do all work directly.
- Decimal precision: All quantities `NUMERIC(12, 3)` (`BigDecimal`), all monetary amounts `NUMERIC(12, 2)` (`BigDecimal`).

## Deliverables

### 1. DTOs (package `com.alamin.pos.dto`)
- `CustomerRequest.java`:
  - `name`, `fatherName`, `businessName`, `phone`, `whatsappNumber`, `email`, `villageAddress`, `customerType` ('WHOLESALE' or 'RETAIL'), `creditLimit`, `mfsType`, `mfsNumber`, `bankName`, `bankBranch`, `bankAccountNo`.
- `CustomerPaymentRequest.java`:
  - `BigDecimal amount` (required, > 0)
  - `String paymentMethod` (optional: 'CASH', 'BKASH', 'NAGAD', 'BANK_TRANSFER', default 'CASH')
  - `String moneyReceiptNo` (optional: paper voucher number)
  - `String notes` (optional)
- `SaleReturnItemRequest.java`:
  - `Long lotId` (required)
  - `BigDecimal quantity` (required, > 0)
  - `BigDecimal refundPrice` (required)
  - `Boolean isDamaged` (default false)
  - `String restockLocation` ('DOKAN' or 'GODOWN', default 'DOKAN')
- `SaleReturnRequest.java`:
  - `Long originalSaleId` (optional: null for direct receipt-less return)
  - `Long customerId` (optional: required if refundType is 'DUE_ADJUSTMENT')
  - `String refundType` (required: 'CASH_REFUND' or 'DUE_ADJUSTMENT')
  - `String reason` (optional)
  - `List<SaleReturnItemRequest> items` (required, at least 1)
- `CustomerLedgerDto.java`:
  - `Long id`, `LocalDateTime transactionDate`, `String transactionType`, `BigDecimal debit`, `BigDecimal credit`, `BigDecimal balanceAfter`, `String moneyReceiptNo`, `Long saleId`, `String notes`.
- `SaleReturnResponse.java`:
  - `Long id`, `String returnNo`, `Long originalSaleId`, `String customerName`, `LocalDateTime returnDate`, `BigDecimal totalRefundAmount`, `String refundType`, `String reason`, `List<SaleReturnItemDto> items`.

### 2. Services (package `com.alamin.pos.service`)
- `CustomerService`:
  - `@Transactional Customer createCustomer(CustomerRequest request)`
  - `@Transactional Customer updateCustomer(Long id, CustomerRequest request)`
  - `Customer getCustomer(Long id)`
  - `List<Customer> searchCustomers(String query, String customerType)`
  - `@Transactional CustomerLedger recordPayment(Long customerId, CustomerPaymentRequest request)`:
    - Finds customer.
    - Subtracts `request.getAmount()` from `customer.getCurrentDue()`.
    - Creates `CustomerLedger` entry: `transactionType = 'CASH_PAYMENT'`, `credit = amount`, `debit = 0`, `balanceAfter = customer.getCurrentDue()`, `moneyReceiptNo = request.getMoneyReceiptNo()`, `notes = request.getNotes()`.
    - Saves and returns ledger entry.
  - `List<CustomerLedger> getCustomerLedger(Long customerId)`
- `SaleReturnService`:
  - `@Transactional SaleReturnResponse processReturn(SaleReturnRequest request)`:
    - Synthesizes `returnNo`: `RET-` + date + `-` + 4 random digits.
    - Validates: If `refundType.equals("DUE_ADJUSTMENT")`, `customerId` must be present.
    - Calculates total refund amount.
    - For each item:
      - If `!item.getIsDamaged()`:
        - Increases `StockInventory` for `lotId` at `restockLocation`.
        - If `restockLocation.equals("GODOWN")`, logs `GodownMovement` (`movementType = 'RETURN_ENTRY'`).
      - If `item.getIsDamaged()`:
        - Do not restock into sellable inventory.
    - If `refundType.equals("DUE_ADJUSTMENT")`:
      - Deducts `totalRefundAmount` from `customer.getCurrentDue()`.
      - Creates `CustomerLedger` entry: `transactionType = 'RETURN_CREDIT'`, `credit = totalRefundAmount`, `debit = 0`, `balanceAfter = customer.getCurrentDue()`, `notes = "Return Credit: " + returnNo`.
    - Persists `SaleReturn` and `SaleReturnItem`s.
    - Returns `SaleReturnResponse`.
  - `SaleReturnResponse getReturnById(Long id)`
  - `List<SaleReturnResponse> getRecentReturns(int limit)`

### 3. Controllers (package `com.alamin.pos.controller`)
- `CustomerController`:
  - `POST /api/customers`
  - `PUT /api/customers/{id}`
  - `GET /api/customers` (supports `?query=...` and `?type=...`)
  - `GET /api/customers/{id}`
  - `GET /api/customers/{id}/ledger`
  - `POST /api/customers/{id}/payments`
- `SaleReturnController`:
  - `POST /api/returns`
  - `GET /api/returns/{id}`
  - `GET /api/returns`

### 4. Tests (`backend/src/test/java/com/alamin/pos/service/CustomerAndReturnTest.java`)
Test cases:
1. **Customer Creation & Query**: Create wholesale dealer with MFS and credit limit, verify retrieval.
2. **Customer Due Repayment**: Customer has 15,000 due; pays 5,000 with MR No "MR-1001"; verify due drops to 10,000, ledger row created with balance 10,000 and MR number.
3. **Direct Return Without Invoice (Restock to Dokan)**: Return 2 bottles without original invoice; verify Dokan stock increases by 2; refund cash.
4. **Direct Return with Due Adjustment**: Return 3 bottles without invoice, adjust due of customer with 10,000 due -> customer due drops to 8,050, `RETURN_CREDIT` ledger created.
5. **Damaged Item Return**: Return 1 damaged packet; verify sellable stock is NOT incremented.
6. **Validation**: Due adjustment without customer throws `IllegalArgumentException`.

## Verification Command
Run in `backend/`:
`./gradlew test --tests CustomerAndReturnTest`
Ensure it compiles, executes, and passes with 0 failures.

## Reporting
- Commit changes: `feat: implement customer due ledger and direct sales return service`
- Write report to: `.superpowers/sdd/pos-inventory-syngenta/task-7-report.md`
- Report back with DONE, commit hash, and test verification output.
