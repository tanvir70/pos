# Task 9 Brief: Frontend API Client & Refactored Component Architecture

## Context & Objectives
You are the implementer for Task 9.
Your goal is to build the TypeScript domain types matching backend DTOs, a robust `fetch`-based API client with error handling, API endpoint functions, and a modern `Navbar.tsx` featuring bilingual navigation, Owner Mode (4-digit PIN toggle for hiding/showing profit & costs), and the 1-Click Database Backup button.

## Strict Rules
- Ponytail engineering: Zero unnecessary dependencies. Use native browser `fetch`. Keep code lean, typed, and clean.
- Zero assumptions: If any business or technical judgment is made, add `// BUSINESS DECISION:` directly in code and append a line to `DECISIONS_LOG.md`.
- No subagents contract: Do NOT invoke any subagents. You do all work directly.
- Frontend build must pass cleanly (`pnpm build`).

## Deliverables

### 1. Types (`frontend/src/types/index.ts`)
Define TypeScript types aligned with backend:
- `Product`: `id`, `productCode`, `nameEn`, `nameBn`, `companyName`, `category`, `baseUnit`, `cartonMultiplier`, `defaultBarcode`, `standardRetailPrice`, `standardWholesalePrice`, `minStockAlert`.
- `InventoryLot`: `id`, `productId`, `lotNumber`, `entryDate`, `expiryDate`, `purchaseCost`, `lotRetailPrice`, `lotWholesalePrice`, `barcode`, `supplierName`, `challanNo`.
- `StockItem`: `productId`, `productCode`, `nameEn`, `nameBn`, `category`, `baseUnit`, `cartonMultiplier`, `defaultBarcode`, `lotId`, `lotNumber`, `entryDate`, `expiryDate`, `purchaseCost`, `lotRetailPrice`, `lotWholesalePrice`, `lotBarcode`, `dokanQuantity`, `godownQuantity`, `totalQuantity`.
- `Customer`: `id`, `name`, `fatherName`, `businessName`, `phone`, `whatsappNumber`, `email`, `villageAddress`, `customerType` ('WHOLESALE' | 'RETAIL'), `creditLimit`, `currentDue`, `mfsType`, `mfsNumber`, `bankName`, `bankBranch`, `bankAccountNo`.
- `CustomerLedger`: `id`, `customerId`, `transactionDate`, `transactionType`, `debit`, `credit`, `balanceAfter`, `moneyReceiptNo`, `saleId`, `notes`.
- `SaleRequest`: `customerId?`, `saleMode`: 'RETAIL' | 'WHOLESALE', `items`: `SaleItemRequest[]`, `discount?`, `roundOff?`, `paymentMethod?`, `cashPaid?`, `digitalPaid?`, `digitalMedium?`, `digitalTrxId?`, `cashierName?`.
- `SaleItemRequest`: `lotId`, `totalQuantity`, `dokanQuantity?`, `godownQuantity?`, `unitPrice`.
- `SaleResponse`: `id`, `invoiceNo`, `saleDate`, `customerId?`, `customerName?`, `customerPhone?`, `saleMode`, `subtotal`, `discount`, `roundOff`, `totalAmount`, `paymentMethod`, `cashPaid`, `digitalPaid`, `dueAmount`, `totalProfit?`, `items`: `SaleItemResponse[]`.
- `SaleItemResponse`: `id`, `lotId`, `productNameEn`, `productNameBn`, `lotNumber`, `barcode`, `totalQuantity`, `dokanQuantity`, `godownQuantity`, `unitPrice`, `unitCost`, `subtotal`, `profit`.
- `SaleReturnRequest`: `originalSaleId?`, `customerId?`, `refundType`: 'CASH_REFUND' | 'DUE_ADJUSTMENT', `reason?`, `items`: `SaleReturnItemRequest[]`.
- `SaleReturnItemRequest`: `lotId`, `quantity`, `refundPrice`, `isDamaged?`, `restockLocation`: 'DOKAN' | 'GODOWN'.
- `SaleReturnResponse`: `id`, `returnNo`, `originalSaleId?`, `customerName?`, `returnDate`, `totalRefundAmount`, `refundType`, `reason`, `items`: any[].
- `DashboardSummary`: `totalSalesToday`, `totalSalesMonth`, `grossProfitToday`, `grossProfitMonth`, `cashInDrawerToday`, `totalMarketDue`, `totalCustomers`, `lowStockCount`, `expiringSoonCount`, `expiringLots`: any[], `lowStockProducts`: any[].
- `LotEntryRequest`: `productId`, `lotNumber`, `entryDate?`, `expiryDate`, `purchaseCost`, `lotRetailPrice`, `lotWholesalePrice`, `barcode?`, `supplierName?`, `challanNo?`, `quantityCartons?`, `quantityBaseUnits?`, `location?`.
- `StockTransferRequest`: `lotId`, `fromLocation`, `toLocation`, `quantity`, `remarks?`.
- `CustomerPaymentRequest`: `amount`, `paymentMethod?`, `moneyReceiptNo?`, `notes?`.

### 2. API Client (`frontend/src/api/client.ts`)
- Base URL configuration (defaults to `/api`, proxied in Vite or direct `http://localhost:8080/api`).
- Configure Vite proxy in `frontend/vite.config.ts`: `/api` forwards to `http://localhost:8080`.
- Native `fetch` wrapper `apiClient<T>(url: string, options?: RequestInit): Promise<T>`.
- Automatic JSON parsing and error response extraction.
- Helper for blob/binary download (used for 1-click database backup and barcode PNG).

### 3. API Endpoints (`frontend/src/api/endpoints.ts`)
Clean typed functions for:
- Products: `getProducts()`, `createProduct(p)`
- Inventory & Lots: `getStock()`, `getLots(productId?, fefo?)`, `createLot(data)`, `transferStock(data)`
- Barcode: `getBarcodePngUrl(barcode)`, `getLotBarcodePngUrl(lotId)`
- Sales: `createSale(data)`, `getSaleById(id)`, `getSaleByInvoice(invoiceNo)`, `getRecentSales(limit?)`
- Customers & Ledger: `getCustomers(query?, type?)`, `createCustomer(c)`, `updateCustomer(id, c)`, `getCustomer(id)`, `getCustomerLedger(id)`, `recordPayment(id, payment)`
- Returns: `createReturn(data)`, `getReturn(id)`, `getRecentReturns(limit?)`
- Dashboard: `getDashboardSummary()`
- Backup: `downloadDatabaseBackup()` (triggers browser file download of `syngenta-pos-backup-....sql`)

### 4. Navbar Component (`frontend/src/components/Navbar.tsx`)
- App header with Store Name: "আল-আমিন ট্রেডার্স (সিনজেনটা ডিলার)" / "Al-Amin Traders (Syngenta)".
- Navigation Tabs:
  1. `pos` - "বিক্রয় কাউন্টার (POS)"
  2. `dashboard` - "ড্যাশবোর্ড (Analytics)"
  3. `inventory` - "পণ্য ও স্টক (Catalog)"
  4. `godown` - "গুদাম ও চালান (Godown)"
  5. `customers` - "বাকি খাতা (Ledger)"
  6. `returns` - "পণ্য ফেরত (Returns)"
- 1-Click Database Backup Button:
  - Prominent button with download icon: "💾 ব্যাকআপ ডাউনলোড".
  - Calls `downloadDatabaseBackup()` and triggers instant file download.
  - Shows quick downloading / success state.
- Admin / Cashier PIN Lock:
  - Toggle button: "🔒 ক্যাশিয়ার মোড" vs "👑 মালিক মোড (Admin)".
  - 4-digit PIN prompt (default PIN: `1234`).
  - When unlocked, admin state `isOwner` is true, enabling gross profit visibility and purchase cost viewing.

## Verification
- In `frontend/`, run `pnpm build`.
- Must compile with 0 TypeScript errors and output Vite production build.

## Reporting
- Commit changes: `feat: implement frontend api client, types, vite proxy and navbar`
- Write report to: `.superpowers/sdd/pos-inventory-syngenta/task-9-report.md`
- Report back with DONE, commit hash, and test verification output.
