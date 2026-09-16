# Task 9 Report: Frontend API Client & Refactored Component Architecture

**Status:** DONE  
**Commit Hash:** `3c69d7e` (`feat: implement frontend api client, types, vite proxy and navbar`)  

---

## Summary of Deliverables

### 1. Types Module (`frontend/src/types/index.ts`)
Created comprehensive TypeScript domain interfaces and DTOs matching backend Spring Boot entities and REST schemas:
- `Product`: Complete catalog item interface (`id`, `productCode`, `nameEn`, `nameBn`, `companyName`, `category`, `baseUnit`, `cartonMultiplier`, `defaultBarcode`, `standardRetailPrice`, `standardWholesalePrice`, `minStockAlert`, optional `imagePath`, `createdAt`).
- `InventoryLot`: Lot batch definition (`id`, `productId`, `lotNumber`, `entryDate`, `expiryDate`, `purchaseCost`, `lotRetailPrice`, `lotWholesalePrice`, `barcode`, `supplierName`, `challanNo`).
- `StockItem`: Unified stock overview representation (`productId`, `productCode`, `nameEn`, `nameBn`, `category`, `baseUnit`, `cartonMultiplier`, `defaultBarcode`, `lotId`, `lotNumber`, `entryDate`, `expiryDate`, `purchaseCost`, `lotRetailPrice`, `lotWholesalePrice`, `lotBarcode`, `barcode`, `dokanQuantity`, `godownQuantity`, `totalQuantity`).
- `Customer` & `CustomerRequest`: Debtor customer profiles (`id`, `name`, `fatherName`, `businessName`, `phone`, `whatsappNumber`, `email`, `villageAddress`, `customerType`, `creditLimit`, `currentDue`, `mfsType`, `mfsNumber`, `bankName`, `bankBranch`, `bankAccountNo`).
- `CustomerLedger` & `CustomerPaymentRequest`: Debtor account transaction history and cash repayments (`transactionDate`, `transactionType`, `debit`, `credit`, `balanceAfter`, `moneyReceiptNo`, `saleId`, `notes`).
- `SaleRequest`, `SaleItemRequest`, `SaleResponse`, `SaleItemResponse`: Full POS transaction payload interfaces with split-stock locations (`dokanQuantity`, `godownQuantity`), line unit price overrides, invoice discounts, round-off deductions, and gross margin profit tracking.
- `SaleReturnRequest`, `SaleReturnItemRequest`, `SaleReturnResponse`: Sales return payload definitions supporting direct receipt-less returns, damaged item quarantine routing, and customer credit ledger adjustments (`CASH_REFUND` vs. `DUE_ADJUSTMENT`).
- `DashboardSummary`, `ExpiringLot`, `LowStockProduct`: Financial KPIs and alert metrics interfaces (`totalSalesToday`, `totalSalesMonth`, `grossProfitToday`, `grossProfitMonth`, `cashInDrawerToday`, `totalMarketDue`, `totalCustomers`, `lowStockCount`, `expiringSoonCount`, `expiringLots`, `lowStockProducts`).
- Domain Enums & Union Types: `SaleMode`, `CustomerType`, `RefundType`, `StockLocation`, `PaymentMethod`, `NavigationTab`.

### 2. Native Fetch API Client (`frontend/src/api/client.ts`)
- Configured base URL with environment variable fallback: `const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'`.
- Implemented lean native `fetch` wrapper `apiClient<T>(endpoint, options?)` with automatic JSON header management, HTTP error status parsing, and typed `ApiError` generation.
- Implemented `downloadBlob(endpoint, fallbackFilename, options?)` for browser file downloads with automatic `Content-Disposition` attachment filename extraction.
- Implemented `fetchBlob(endpoint, options?)` for raw binary image downloads.
- Adhered strictly to Ponytail Rules: Zero external HTTP libraries (no Axios), minimal footprint, lean and typed.

### 3. Typed Endpoints Client (`frontend/src/api/endpoints.ts`)
- **Products**: `getProducts(query?)`, `createProduct(product)`.
- **Inventory & Lots**: `getStock()`, `getLots(productId?, fefo?)`, `createLot(data)`, `transferStock(data)`.
- **Barcodes**: `getBarcodePngUrl(barcode, width?, height?)`, `getLotBarcodePngUrl(lotId, width?, height?)`.
- **Sales Engine**: `createSale(data)`, `getSaleById(id)`, `getSaleByInvoice(invoiceNo)`, `getRecentSales(limit?)`.
- **Customers & Ledger**: `getCustomers(query?, type?)`, `createCustomer(c)`, `updateCustomer(id, c)`, `getCustomer(id)`, `getCustomerLedger(id)`, `recordPayment(id, payment)`.
- **Sales Returns**: `createReturn(data)`, `getReturn(id)`, `getRecentReturns(limit?)`.
- **Dashboard Analytics**: `getDashboardSummary()`.
- **Database Backup**: `downloadDatabaseBackup()` invoking 1-click browser download of SQL backup dump.

### 4. Bilingual Navbar Component (`frontend/src/components/Navbar.tsx`)
- App header featuring store branding: "আল-আমিন ট্রেডার্স (সিনজেনটা ডিলার)" / "Al-Amin Traders (Syngenta Authorized Dealership)".
- 6 bilingual navigation tabs with icons:
  1. `pos` — "বিক্রয় কাউন্টার (POS)"
  2. `dashboard` — "ড্যাশবোর্ড (Analytics)"
  3. `inventory` — "পণ্য ও স্টক (Catalog)"
  4. `godown` — "গুদাম ও চালান (Godown)"
  5. `customers` — "বাকি খাতা (Ledger)"
  6. `returns` — "পণ্য ফেরত (Returns)"
- 1-Click Database Backup Button:
  - Prominent download button: "💾 ব্যাকআপ ডাউনলোড".
  - Async state machine: `idle` -> `loading` ("⏳ ব্যাকআপ হচ্ছে...") -> `success` ("✅ ব্যাকআপ সম্পন্ন") / `error`.
  - Triggers instant browser download of complete SQL database dump without page reload.
- Admin / Cashier PIN Lock:
  - Mode toggle: "🔒 ক্যাশিয়ার মোড" vs "👑 মালিক মোড (Admin)".
  - 4-digit PIN modal prompt (default PIN: `1234`).
  - Toggles `isOwner` state across the application:
    - When locked (Cashier Mode): Purchase costs (কেনা দাম) and gross profit margins are concealed to protect wholesale margins from retail customer view during bargaining.
    - When unlocked (Owner Mode): Purchase costs and live gross margins are revealed across cart items, cash drawer summaries, and inventory valuation tables.
  - 1-click immediate relock button back to Cashier Mode.

### 5. Vite Proxy & Backend Integration
- Added `/api` proxy in `frontend/vite.config.ts` targeting `http://localhost:8080` with `changeOrigin: true` for development server and preview server.
- Added `ProductController.java` (`/api/products`) in backend to expose database product catalog queries and creations.
- App shell in `frontend/src/App.tsx` refactored to mount the new `Navbar` and propagate `isOwner` and active tab state.

### 6. Decisions Log Updates (`DECISIONS_LOG.md`)
Logged 3 business and technical architecture decisions:
1. **Frontend Admin Mode PIN Protection**: Default Owner PIN set to `1234` in local state, allowing counter managers to toggle Owner Mode to reveal purchase costs and profit margins without backend session overhead.
2. **Frontend API Client Native Fetch & Vite Proxy**: Frontend uses native browser `fetch` targeting `/api` prefixed endpoints, routed to backend `http://localhost:8080` via Vite development proxy and configurable via `VITE_API_BASE_URL`.
3. **Product Catalog REST Controller**: Provide `/api/products` endpoints (`GET` with optional search query and `POST` for product creation) to expose the seeded Syngenta catalog and allow adding new products.

---

## Verification & Build Results

### Frontend Verification
```bash
$ pnpm build
vite v8.0.5 building client environment for production...
transforming (19) src/index.css✓ 19 modules transformed.
rendering chunks (1)...computing gzip size...
dist/robots.txt                   0.02 kB │ gzip:  0.04 kB
dist/index.html                   0.95 kB │ gzip:  0.43 kB
dist/assets/index-DLw3aU9Z.css   31.23 kB │ gzip:  6.44 kB
dist/assets/index-CBqutbGB.js   237.87 kB │ gzip: 70.72 kB
✓ built in 277ms
```

### Backend Test Verification
```bash
$ ./gradlew test
> Task :compileJava UP-TO-DATE
> Task :processResources UP-TO-DATE
> Task :classes UP-TO-DATE
> Task :compileTestJava UP-TO-DATE
> Task :processTestResources NO-SOURCE
> Task :testClasses UP-TO-DATE
> Task :test UP-TO-DATE
BUILD SUCCESSFUL in 1s
```
