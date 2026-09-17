# Task 12 Brief: Customer Due Ledger, Direct Returns & Analytics Dashboard UI

## Context & Objectives
You are the implementer for Task 12.
Your goal is to build:
1. `frontend/src/pages/Customers.tsx`: Complete Customer & Due Ledger management with Wholesale profiles, WhatsApp links, credit limit tracking, Money Receipt (MR No.) cash collection modal, and printable ledger history drawer.
2. `frontend/src/pages/Returns.tsx`: Sales returns supporting direct chemical returns without receipts, damaged container quarantine routing, and cash refunds vs due adjustments.
3. `frontend/src/pages/Dashboard.tsx`: Executive analytics dashboard showing Today's/Month's Sales, Live Cash in Drawer, Total Market Due, Expiring-Soon lot alerts (<30 days), Low Stock alerts, and Owner-Mode protected Gross Profit.
4. `frontend/src/App.tsx`: Refactor `App.tsx` to seamlessly wire all pages with `Navbar`, removing legacy mock grocery data completely.

## Strict Rules
- Ponytail engineering: Clean, reactive, minimal, zero unnecessary dependencies.
- Zero assumptions: If any business or technical judgment is made, add `// BUSINESS DECISION:` directly in code and append a line to `DECISIONS_LOG.md`.
- No subagents contract: Do NOT invoke any subagents. You do all work directly.
- Ensure `pnpm build` in `frontend/` succeeds with 0 errors.

## Deliverables

### 1. `frontend/src/pages/Customers.tsx`
- Props: `isOwner: boolean`.
- Fetches customers via `getCustomers()`.
- Search by Name, Business Name, or Phone.
- Filters: All, Wholesale Only (পাইকারি ডিলার), Retail Only (খুচরা কৃষক), Has Due Only (বাকি আছে).
- Add Customer Modal:
  - Full fields: Name, Father's Name, Business Name, Phone, WhatsApp, Village, Type (WHOLESALE/RETAIL), Credit Limit, MFS Type & Number, Bank Name, Branch, Account No.
- Due Repayment Modal:
  - Repayment amount with quick shortcuts (50%, 75%, 100% of due).
  - Payment method selector.
  - **Money Receipt No (MR No. / মানি রিসিট)** input field.
  - Calls `recordPayment()`, refreshes customer due.
- Customer Ledger Statement Drawer/Modal:
  - Fetches `getCustomerLedger(customerId)`.
  - Displays audit table: Date, Type (`INVOICE_BILL`, `CASH_PAYMENT`, `RETURN_CREDIT`), Debit, Credit, Balance After, MR No, Notes.
  - Print Ledger Statement button.

### 2. `frontend/src/pages/Returns.tsx`
- Props: `isOwner: boolean`.
- Loads active stock via `getStock()` and customers via `getCustomers()`.
- Direct Return Form:
  - Original Invoice No (Optional input - can be left blank for direct returns!).
  - Customer selection (Optional for cash refund, required for due adjustment).
  - Item selector (Product & Lot from active stock).
  - Quantity to return.
  - Refund Rate (Unit price refunded).
  - Checkbox: "নষ্ট / ক্ষতিগ্রস্ত কেমিক্যাল (Damaged - Quarantine)" - marks `isDamaged: true`.
  - Restock Location: `DOKAN` or `GODOWN`.
  - Refund Type: `CASH_REFUND` (নগদ ফেরত) or `DUE_ADJUSTMENT` (বাকি সমন্বয়).
  - Reason (text).
  - Submits to `createReturn()`, shows confirmation with return voucher number.
- Recent Returns Table:
  - Return No, Date, Customer, Refund Amount, Refund Type, Reason.

### 3. `frontend/src/pages/Dashboard.tsx`
- Props: `isOwner: boolean`, `onOpenPinModal: () => void`.
- Loads data via `getDashboardSummary()`.
- Metric Cards:
  - Today's Sales (`totalSalesToday`)
  - Month's Sales (`totalSalesMonth`)
  - Live Cash in Drawer (`cashInDrawerToday`) - net physical cash in store till.
  - Total Market Due (`totalMarketDue`) - total outstanding credit in village.
  - Today's Gross Profit (`grossProfitToday`) & Month's Profit - visible only if `isOwner` is true, otherwise masked with lock icon and click to enter PIN.
  - Total Customer Count & Low Stock Count.
- Alert Sections:
  - **Expiring Lots Alert (<30 days)**: Red/amber alert banner showing lot number, product name, expiry date, days until expiry, and Dokan/Godown balance.
  - **Low Stock Alert**: Products below `minStockAlert` with reorder advice.
- Quick Actions:
  - Direct buttons to "নতুন বিক্রয় (POS)", "চালান এন্ট্রি (Godown)", "বাকি আদায় (Ledger)", "ডাটাবেজ ব্যাকআপ".

### 4. `frontend/src/App.tsx`
- Complete refactoring:
  - Import and render:
    - `Navbar`
    - `tab === 'pos' && <PosCounter isOwner={isOwner} />`
    - `tab === 'dashboard' && <Dashboard isOwner={isOwner} onOpenPinModal={...} />`
    - `tab === 'inventory' && <Inventory isOwner={isOwner} />`
    - `tab === 'godown' && <Godown isOwner={isOwner} />`
    - `tab === 'customers' && <Customers isOwner={isOwner} />`
    - `tab === 'returns' && <Returns isOwner={isOwner} />`
  - Remove all obsolete mock grocery data (`Miniket Rice`, `Soybean Oil`, etc.) and inline legacy components.

## Verification
- Run `pnpm build` in `frontend/`.
- Ensure 0 errors.

## Reporting
- Commit changes: `feat: implement customer ledger, direct returns, analytics dashboard and app shell`
- Write report to: `.superpowers/sdd/pos-inventory-syngenta/task-12-report.md`
- Report back with DONE, commit hash, and test verification output.
