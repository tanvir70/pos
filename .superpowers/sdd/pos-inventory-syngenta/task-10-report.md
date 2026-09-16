# Task 10 Report: Refactor POS Billing Counter (Split-Stock, Lot Override & Dual Print)

**Status:** DONE  
**Commit:** `92ee0ede29ee36d2026084562cca08f1357f136e` (`92ee0ed`)  
**Timestamp:** 2026-09-17T02:57:00+06:00  

---

## 1. Overview & Deliverables Completed

All five required deliverables plus system-level integration and print styles have been built and verified:

### 1. `frontend/src/components/LotSelectorDropdown.tsx`
- **FEFO Smart Default:** Evaluates active lots for each product and tags the nearest expiry lot as `"FEFO প্রস্তাবিত"`.
- **Manual Cashier Override:** Dropdown allows 1-click override to select any physical batch on hand.
- **Privacy Masking:** Hides purchase cost (`কেনা: ৳***`) unless `isOwner` is true, displaying retail and wholesale prices alongside expiry dates and barcodes.

### 2. `frontend/src/components/SplitStockModal.tsx`
- **Stock Split Breakdown:** Displays total requested quantity, Dokan counter stock, and Godown bulk stock.
- **1-Click Quick Action Buttons:**
  - *"সব দোকান থেকে"* (All from Dokan - allows Dokan counter to go negative for rush sales).
  - *"ঘাটতি গুদাম থেকে"* (Fulfill deficit from Godown - auto-computes deficit when Dokan stock is low).
  - *"সব গুদাম থেকে"* (All from Godown - pulls 100% directly from warehouse storage).
- **Asymmetric Validation:** Prevents negative inventory allocation in Godown bulk storage while allowing negative Dokan allocation.

### 3. `frontend/src/components/ThermalReceipt.tsx`
- **80mm/58mm Thermal Roll Optimization:** Formatted for high-speed counter thermal printers with `@media print`.
- **Branding & Metadata:** Contains dealership letterhead ("মেসার্স আল-আমিন ট্রেডার্স", Syngenta Dealership, Narsingdi, Phone numbers), invoice number, date, cashier, sale mode, customer profile.
- **Financial Breakdown:** Subtotal, line-item quantities and rates, discount, 1-click round-off, total payable, cash/digital paid (MFS medium & TrxID), and due balance.
- **Dealership Footer:** "ধন্যবাদ, আবার আসবেন! সিনজেনটা মানসম্মত ফসলের নিশ্চয়তা।"

### 4. `frontend/src/components/A4InvoicePrint.tsx`
- **Wholesale Legal Challan & Invoice:** Full A4 document format with `@media print` styling for agro-dealers and commercial farmers.
- **Dealer Letterhead & Customer Profile:** Full business address, Syngenta distributor banner, customer proprietor name, father's name, village address, WhatsApp, and phone numbers.
- **Tabular Itemization:** Columns for SL, Product Description (Bengali & English), Lot No, Expiry Date, Base Units, Cartons, Unit Rate, and Line Total.
- **Cumulative Ledger Summary:** Integrates previous due balance, current bill, cash/digital payments, and net outstanding due.
- **Dual Signatures:** Legal signature lines for *"ক্রেতার স্বাক্ষর"* (Customer / Received By) and *"বিক্রেতার স্বাক্ষর"* (Authorized Signatory, Al-Amin Traders).

### 5. `frontend/src/pages/PosCounter.tsx`
- **Live Spring Boot Integration:** Connected to `/api/inventory/stock`, `/api/customers`, and `/api/sales`.
- **Fast Search & Barcode Auto-Add:** Auto-focused search bar with instant name lookup (Bengali & English) and instant barcode scanning (`SYN-AMI-202601`). Pressing Enter on barcode match immediately adds product to cart.
- **Retail / Wholesale Mode Toggle:** Instantly switches catalog rates between `lotRetailPrice` and `lotWholesalePrice`.
- **Line-Item Bargaining Override:** Directly editable unit price field on each cart row with standard catalog strike-through.
- **Split-Stock Status Badges:** Displays Dokan and Godown counts with amber/red deficit alerts.
- **Owner Margin Privacy:** Purchase cost and gross profit margin are visible exclusively when Owner Mode (`isOwner`) is active.
- **1-Click Round-Off:** Clears fractional change (৳1-৳9) directly on invoice total without distorting individual product rates.
- **Customer Due Safeguard:** Blocks unpaid sales unless customer is selected in customer dropdown.
- **Keyboard Shortcuts:** Auto-focus and `F2` key to complete sale.
- **Success Modal:** Immediate confirmation modal with direct 1-click buttons for *"প্রিন্ট ক্যাশ মেমো (80mm)"* and *"প্রিন্ট পাইকারি চালান (A4)"*, and automatic live stock reload.

---

## 2. Business Decisions Logged (`DECISIONS_LOG.md`)

| Topic | Decision | Operational Rationale |
| :--- | :--- | :--- |
| **Dual Print Formats (80mm & A4)** | Provide both 80mm thermal receipt and full A4 Wholesale Challan with dual signatures. | Counter retail farmers require compact paper receipts, while wholesale dealers require formal signed legal challans with full ledger history. |
| **In-Line POS Bargaining Price Override** | Allow direct line-item unit price editing on cart items while displaying purchase cost & profit margin in Owner Mode. | Rural agro-dealers negotiate bulk pesticide prices per-farmer; requires instant rate adjustments without altering master catalog prices. |
| **POS Split-Stock & 1-Click Deficit Allocation** | Fulfill single sales items across Dokan counter and Godown bulk warehouse with 1-click deficit fulfillment. | Prevents counter walkaways when counter shelves run low while bulk cartons sit in the rear warehouse. |

---

## 3. Verification & Build Summary

- **Build Command:** `pnpm build` in `frontend/`
- **Result:** Success (0 errors, 0 warnings, 275ms - 306ms build time)
- **Output Artifacts:**
  - `dist/assets/index-*.css` (43.83 kB)
  - `dist/assets/index-*.js` (296.70 kB)
- **Git Commit:** `92ee0ede29ee36d2026084562cca08f1357f136e`
