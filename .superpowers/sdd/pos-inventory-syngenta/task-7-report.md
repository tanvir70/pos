# Task 7 Report: Customer Due Ledger & Direct Returns

**Status:** DONE  
**Commit Hash:** `ecbb43c` (`feat: implement customer due ledger and direct sales return service`)  

---

## Summary of Deliverables

### 1. DTOs (`com.alamin.pos.dto`)
Implemented request and response data transfer objects with Jakarta Bean Validation and decimal precision enforcement:
- `CustomerRequest`:
  - Captures full wholesale and retail customer profile details: `name`, `fatherName`, `businessName`, `phone`, `whatsappNumber`, `email`, `villageAddress`, `customerType` ('WHOLESALE' or 'RETAIL'), `creditLimit`, `currentDue`/`initialDue`, `mfsType`, `mfsNumber`, `bankName`, `bankBranch`, and `bankAccountNo`.
- `CustomerPaymentRequest`:
  - `amount` (`BigDecimal`, `@NotNull`, min `0.01`): Payment amount collected.
  - `paymentMethod` (`String`, default `'CASH'`): Payment method channel ('CASH', 'BKASH', 'NAGAD', 'BANK_TRANSFER').
  - `moneyReceiptNo` (`String`): Stamped paper voucher number (MR No.).
  - `notes` (`String`): Transaction remarks.
- `SaleReturnItemRequest`:
  - `lotId` (`Long`, `@NotNull`): Identification of the specific inventory lot returned.
  - `quantity` (`BigDecimal`, `@NotNull`, min `0.001`): Quantity returned.
  - `refundPrice` (`BigDecimal`, `@NotNull`, min `0.00`): Refund price per base unit.
  - `isDamaged` (`Boolean`, default `false`): Quarantined damage flag.
  - `restockLocation` (`String`, default `'DOKAN'`): 'DOKAN' or 'GODOWN'.
- `SaleReturnRequest`:
  - `originalSaleId` (`Long`): Optional reference (null for direct receipt-less returns).
  - `customerId` (`Long`): Optional reference (mandatory for `DUE_ADJUSTMENT`).
  - `refundType` (`String`, `@NotBlank`): 'CASH_REFUND' or 'DUE_ADJUSTMENT'.
  - `reason` (`String`): Return notes.
  - `items` (`List<SaleReturnItemRequest>`, `@NotEmpty`, `@Valid`): Return line items.
- `CustomerLedgerDto`:
  - Detailed statement DTO for customer credit statements (`id`, `customerId`, `customerName`, `transactionDate`, `transactionType`, `debit`, `credit`, `balanceAfter`, `moneyReceiptNo`, `saleId`, `notes`).
- `SaleReturnItemDto`:
  - Line-level return item with lot and product metadata, quantity, refund price, restock location, damaged flag, and subtotal.
- `SaleReturnResponse`:
  - Complete return invoice header with return number, original sale ID, customer info, return date, total refund amount, refund type, reason, and list of returned items.

### 2. Service Layer (`com.alamin.pos.service`)
- `CustomerService`:
  - `createCustomer(CustomerRequest request)`: Validates name/phone uniqueness, sets defaults (credit limit 0, type 'RETAIL'), persists customer, and creates an initial `INVOICE_BILL` opening ledger record if initial due > 0.
  - `updateCustomer(Long id, CustomerRequest request)`: Updates profile information while preserving `currentDue` from direct overwriting to ensure all ledger balance adjustments remain strictly audited.
  - `getCustomer(Long id)`: Retrieves customer entity by primary key.
  - `searchCustomers(String query, String customerType)`: Searches customers by name, phone, or business name and filters by customer type.
  - `recordPayment(Long customerId, CustomerPaymentRequest request)`: Deducts repayment amount from `customer.currentDue`, records a `CASH_PAYMENT` entry in `customer_ledger` with `moneyReceiptNo` and notes, and returns the ledger record.
  - `getCustomerLedger(Long customerId)`: Retrieves full chronological ledger history ordered by `transactionDate DESC, id DESC`.
- `SaleReturnService`:
  - `processReturn(SaleReturnRequest request)`:
    - **Return Number Synthesis**: Formats unique voucher number `RET-YYYYMMDD-XXXX` with 4 random digits and uniqueness verification loop.
    - **Direct Return Support**: Fully supports returns without an original invoice (`originalSaleId == null`).
    - **Damaged Item Quarantine**: Damaged goods (`isDamaged = true`) are quarantined and excluded from sellable Dokan and Godown inventory balances.
    - **Restock Routing**: Sellable items are restocked to either `DOKAN` or `GODOWN`. If restocked to `GODOWN`, an immutable `RETURN_ENTRY` record is logged in `godown_movement`.
    - **Due Adjustment & Ledger**: When `refundType == 'DUE_ADJUSTMENT'`, customer presence is strictly validated, `customer.currentDue` is decremented by `totalRefundAmount`, and a `RETURN_CREDIT` entry is recorded in `customer_ledger`.
    - **Persistence**: Atomically saves `SaleReturn` and associated `SaleReturnItem` records.
  - `getReturnById(Long id)`: Retrieves return by ID.
  - `getRecentReturns(int limit)`: Retrieves recent returns ordered by return date descending.

### 3. REST Controllers (`com.alamin.pos.controller`)
- `CustomerController` (`/api/customers`):
  - `POST /api/customers`: Register new customer profile (HTTP 201 CREATED).
  - `PUT /api/customers/{id}`: Update customer profile (HTTP 200 OK).
  - `GET /api/customers`: Search customers by `query` and `type` (HTTP 200 OK).
  - `GET /api/customers/{id}`: Fetch customer details by ID (HTTP 200 OK).
  - `GET /api/customers/{id}/ledger`: Retrieve customer ledger statement as `CustomerLedgerDto` list (HTTP 200 OK).
  - `POST /api/customers/{id}/payments`: Record cash/digital due repayment voucher (HTTP 201 CREATED).
- `SaleReturnController` (`/api/returns`):
  - `POST /api/returns`: Process customer product return (HTTP 201 CREATED).
  - `GET /api/returns/{id}`: Fetch return details by ID (HTTP 200 OK).
  - `GET /api/returns`: List recent return vouchers (HTTP 200 OK).

### 4. Decisions Log Updates (`DECISIONS_LOG.md`)
Appended 5 business decisions:
1. **Customer Profile Balance Protection**: Profile edits cannot overwrite `currentDue` directly; adjustments occur solely via sales, repayments, and returns.
2. **Customer Opening Balance Ledger Audit**: When a customer is created with an opening due balance, an initial ledger entry is created with `INVOICE_BILL`.
3. **Money Receipt Number for Repayments**: Captures Money Receipt (MR No.) voucher number on `CASH_PAYMENT` customer repayments.
4. **Damaged Return Quarantine Routing**: Quarantines damaged returned goods from active Dokan/Godown sellable stock balances.
5. **Sales Return Debt Credit Adjustment**: Direct returns with `DUE_ADJUSTMENT` credit the customer due balance via `RETURN_CREDIT` ledger entries.

---

## Automated Test Suite (`com.alamin.pos.service.CustomerAndReturnTest`)

Executed 8 tests covering all 6 required brief scenarios plus Godown movement and query endpoints:
1. `testCustomerCreationAndQuery`: Created wholesale dealer with MFS details and credit limit ৳200,000; verified retrieval and search.
2. `testCustomerDueRepayment`: Customer with ৳15,000 due paid ৳5,000 with MR No "MR-1001"; verified due dropped to ৳10,000, and `CASH_PAYMENT` ledger row created with balance ৳10,000 and MR number.
3. `testDirectReturnWithoutInvoiceRestockDokan`: Returned 2 bottles without invoice; verified Dokan stock incremented by 2.000, and ৳1,300 cash refund returned.
4. `testDirectReturnWithDueAdjustment`: Returned 3 bottles without invoice, adjusted due of customer with ৳10,000 due -> customer due dropped to ৳8,050, and `RETURN_CREDIT` ledger created.
5. `testDamagedItemReturn`: Returned 1 damaged packet; verified sellable stock in Dokan was NOT incremented.
6. `testValidationDueAdjustmentWithoutCustomerThrowsException`: Verified `DUE_ADJUSTMENT` without customer ID throws `IllegalArgumentException`.
7. `testRestockToGodownLogsMovement`: Returned 5 bottles to Godown; verified Godown stock incremented by 5.000 and `RETURN_ENTRY` logged in `godown_movement`.
8. `testQueryReturnMethods`: Verified `getReturnById` and `getRecentReturns` functionality.

---

## Verification Commands & Output

### 1. Focused Test Suite:
```bash
./gradlew test --tests CustomerAndReturnTest
```
Output:
```
BUILD SUCCESSFUL in 11s
4 actionable tasks: 3 executed, 1 up-to-date
Tests run: 8, Failures: 0, Errors: 0, Skipped: 0
```

### 2. Full Backend Test Suite:
```bash
./gradlew test
```
Output:
```
BUILD SUCCESSFUL in 11s
4 actionable tasks: 1 executed, 3 up-to-date
All 43 tests passing across entire backend suite (0 failures, 0 errors)
```
