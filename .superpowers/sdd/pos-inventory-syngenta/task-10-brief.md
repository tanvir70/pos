# Task 10 Brief: Refactor POS Billing Counter (Split-Stock, Lot Override & Dual Print)

## Context & Objectives
You are the implementer for Task 10.
Your goal is to build the comprehensive, production-ready POS Billing Counter UI:
1. `frontend/src/components/LotSelectorDropdown.tsx`: FEFO smart default lot picker with manual lot selection dropdown.
2. `frontend/src/components/SplitStockModal.tsx`: Dokan vs Godown split-allocation modal with 1-click deficit fulfillment and negative stock allowance.
3. `frontend/src/components/ThermalReceipt.tsx`: 80mm/58mm thermal receipt print template.
4. `frontend/src/components/A4InvoicePrint.tsx`: Professional A4 Wholesale Challan & Invoice with dual signatures and dealer/customer profiles.
5. `frontend/src/pages/PosCounter.tsx`: The primary interactive sales counter connecting directly to live backend APIs (`/api/inventory/stock`, `/api/customers`, `/api/sales`).

## Strict Rules
- Ponytail engineering: Clean, high responsiveness, zero bulky dependencies.
- Zero assumptions: If any business or technical judgment is made, add `// BUSINESS DECISION:` directly in code and append a line to `DECISIONS_LOG.md`.
- No subagents contract: Do NOT invoke any subagents. You do all work directly.
- Compatibility: Must compile cleanly with `pnpm build` in `frontend/`.

## Deliverables

### 1. `frontend/src/components/LotSelectorDropdown.tsx`
- Props: `lots: InventoryLot[]`, `selectedLotId: number`, `onSelectLot: (lot: InventoryLot) => void`.
- Displays currently selected lot (FEFO default: nearest expiry).
- Clicking opens dropdown showing all active lots for that product with:
  - Lot number, expiry date, purchase cost (masked unless `isOwner` is true), and retail/wholesale prices.
  - Tag for nearest expiry ("FEFO প্রস্তাবিত").

### 2. `frontend/src/components/SplitStockModal.tsx`
- Props: `item: CartItem`, `isOpen: boolean`, `onClose: () => void`, `onApplySplit: (dokanQty: number, godownQty: number) => void`.
- Displays current total requested quantity, available Dokan stock, and available Godown stock.
- Inputs for `dokanQuantity` and `godownQuantity`.
- Quick action buttons:
  - "সব দোকান থেকে" (All from Dokan - allows negative stock if Dokan stock < requested).
  - "ঘাটতি গুদাম থেকে" (Fulfill deficit from Godown).
  - "সব গুদাম থেকে" (All from Godown).

### 3. `frontend/src/components/ThermalReceipt.tsx`
- Props: `sale: SaleResponse`, `onClose: () => void`.
- Formatted strictly for 80mm/58mm thermal receipt rolls with `@media print`.
- Contains:
  - Header: "মেসার্স আল-আমিন ট্রেডার্স", Syngenta Dealership, Narsingdi, Phone.
  - Invoice No, Date, Cashier, Sale Mode (খুচরা / পাইকারি).
  - Customer info (if selected).
  - Table: Product name (Bengali), Qty, Unit Price, Subtotal.
  - Subtotal, Discount, Round-off, Total Amount.
  - Cash Paid, Digital Paid (Medium, TrxID if entered), Due Amount.
  - Footer: "ধন্যবাদ, আবার আসবেন! সিনজেনটা মানসম্মত ফসলের নিশ্চয়তা।"

### 4. `frontend/src/components/A4InvoicePrint.tsx`
- Props: `sale: SaleResponse`, `customer?: Customer`, `onClose: () => void`.
- Professional A4 format for wholesale agro-dealers and large farmers with `@media print`.
- Syngenta dealer letterhead, customer billing info (Proprietor, Business Name, Village, WhatsApp, Phone).
- Table with columns: SL, Product Description, Lot No, Expiry, Base Units, Cartons, Rate, Line Total.
- Financial breakdown with previous due, current invoice, payments, and total outstanding due.
- Dual signature lines: "ক্রেতার স্বাক্ষর" (Customer Signature) and "বিক্রেতার স্বাক্ষর" (Authorized Dealer Signature).

### 5. `frontend/src/pages/PosCounter.tsx`
- Props: `isOwner: boolean`.
- Real-time stock data loaded via `getStock()`.
- Customer list loaded via `getCustomers()`.
- Search & Barcode:
  - Auto-focused search bar supporting barcode scanning (e.g. `SYN-AMI-202601` or standard barcodes) and instant name searching (English & Bengali).
- Retail / Wholesale Mode Toggle:
  - Switches active price between `lotRetailPrice` and `lotWholesalePrice`.
- Cart Management:
  - Product name, package size/unit.
  - Quantity controls (`+`, `-`, manual input).
  - Active Lot dropdown (`LotSelectorDropdown`).
  - Line-item price override input (allows editing unit price directly).
  - Split stock badge (e.g. "দোকান: ৪ | গুদাম: ৬") with click to open `SplitStockModal`.
  - If Dokan stock is low/negative, shows clear amber/red badge but allows sale.
  - Gross profit display on line items (visible ONLY if `isOwner` is true).
- Payment & Checkout Panel:
  - Subtotal calculation.
  - Flat/Percentage discount input.
  - 1-click Round-off button (e.g. rounds ৳1,453 to ৳1,450 by applying ৳3 round-off).
  - Customer selection dropdown (with wholesale/retail badges, current due display, and quick phone search).
  - Payment method tabs: CASH, BKASH, NAGAD, BANK_TRANSFER, DUE, SPLIT.
  - Partial payment inputs: Cash Paid, Digital Paid, Digital Medium, Digital TrxID (optional).
  - Live Due calculation: `due = total - (cash + digital)`.
  - Quick cash buttons (Exact, 50, 100, 500, 1000 multiples).
  - "বিক্রয় সম্পন্ন করুন (F2)" submit button:
    - Calls `createSale()`.
    - Shows success confirmation modal with direct buttons: "প্রিন্ট ক্যাশ মেমো (80mm)" and "প্রিন্ট পাইকারি চালান (A4)".
    - Refreshes live stock immediately.

## Verification
- Run `pnpm build` in `frontend/`.
- Ensure 0 errors.

## Reporting
- Commit changes: `feat: implement pos billing counter with split stock, bargaining override and dual print`
- Write report to: `.superpowers/sdd/pos-inventory-syngenta/task-10-report.md`
- Report back with DONE, commit hash, and test verification output.
