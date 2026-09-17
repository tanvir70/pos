# Task 11 Brief: Inventory, Godown Lots & Barcode Stickers UI

## Context & Objectives
You are the implementer for Task 11.
Your goal is to build:
1. `frontend/src/components/LotEntryModal.tsx`: Incoming shipment entry with live carton multiplier calculation (`cartons * cartonMultiplier + looseUnits`), entry date, challan, purchase cost, and wholesale/retail prices.
2. `frontend/src/components/StockTransferModal.tsx`: Warehouse-to-shop (Godown -> Dokan) stock transfer modal.
3. `frontend/src/components/BarcodeStickerModal.tsx`: Printable barcode sticker generator supporting multi-label printing for physical product containers.
4. `frontend/src/pages/Inventory.tsx`: Catalog and live multi-location stock overview with category filters and low-stock indicators.
5. `frontend/src/pages/Godown.tsx`: Warehouse lot management with arrival entry dates, expiry tracking, carton counts, and shop transfer shortcuts.

## Strict Rules
- Ponytail engineering: Clean, minimal, zero unnecessary dependencies.
- Zero assumptions: If any business or technical judgment is made, add `// BUSINESS DECISION:` directly in code and append a line to `DECISIONS_LOG.md`.
- No subagents contract: Do NOT invoke any subagents. You do all work directly.
- Ensure `pnpm build` in `frontend/` succeeds with 0 errors.

## Deliverables

### 1. `frontend/src/components/LotEntryModal.tsx`
- Props: `products: Product[]`, `isOpen: boolean`, `onClose: () => void`, `onSuccess: () => void`.
- Fields:
  - Product selector.
  - `lotNumber` (e.g. `LOT-2026-05`).
  - `entryDate` (defaults to current date).
  - `expiryDate` (required).
  - `challanNo` (e.g. `CH-SYNG-1044`).
  - `supplierName` (defaults to 'Syngenta Bangladesh Ltd.').
  - `quantityCartons` (e.g. 5 cartons) and `quantityBaseUnits` (e.g. 10 bottles).
  - Live calculation badge: Shows total base units dynamically: `(5 × 20) + 10 = 110 বোতল/প্যাকেট`.
  - `purchaseCost` (per unit).
  - `lotRetailPrice` and `lotWholesalePrice`.
- Submits to `createLot()`, handles errors, triggers `onSuccess()`.

### 2. `frontend/src/components/StockTransferModal.tsx`
- Props: `stockItems: StockItem[]`, `initialLotId?: number`, `isOpen: boolean`, `onClose: () => void`, `onSuccess: () => void`.
- Select lot (shows product name, lot number, available Godown stock and Dokan stock).
- Transfer direction: `GODOWN` -> `DOKAN` (default) or `DOKAN` -> `GODOWN`.
- Quantity to transfer (with Max button filling available source balance).
- Remarks (optional).
- Submits to `transferStock()`, triggers `onSuccess()`.

### 3. `frontend/src/components/BarcodeStickerModal.tsx`
- Props: `item: StockItem | null`, `isOpen: boolean`, `onClose: () => void`.
- Displays printable thermal sticker preview (e.g. 50mm × 25mm label):
  - Company: "Syngenta Bangladesh"
  - Product Name (EN + BN)
  - Lot No & Expiry Date
  - Barcode image fetched from `/api/barcode/{barcode}`
  - MRP (Retail Price): "সর্বোচ্চ খুচরা মূল্য: ৳৬৫০"
- Quantity of stickers input (e.g. 1, 5, 20, 50).
- "প্রিন্ট স্টিকার" button with `@media print` CSS for label printers.

### 4. `frontend/src/pages/Inventory.tsx`
- Props: `isOwner: boolean`.
- Fetches live stock with `getStock()`.
- Search by Product Name (EN/BN) or Code.
- Category filter buttons: All, Insecticide (কীটনাশক), Fungicide (ছত্রাকনাশক), Herbicide (আগাছানাশক), Bio-Stimulant (গ্রোথ প্রমোটার), Seed (বীজ).
- Product Catalog & Stock Table:
  - Product Code, Name (EN/BN), Category, Carton Multiplier.
  - Standard Retail / Wholesale Rate.
  - Dokan Stock, Godown Stock, Total Stock.
  - Low stock warning badge if `totalQuantity <= minStockAlert`.
  - Action buttons: "বারকোড স্টিকার", "লট তালিকা".

### 5. `frontend/src/pages/Godown.tsx`
- Props: `isOwner: boolean`.
- Summary Cards: Total Warehouse Lots, Total Units in Godown, Expiring Soon (<30 days).
- Header Action Buttons:
  - "নতুন চালান / লট এন্ট্রি" -> opens `LotEntryModal`.
  - "দোকানে স্টক স্থানান্তর" -> opens `StockTransferModal`.
- Warehouse Lots Table:
  - Product Name, Lot Number, Entry Date (চালান আসার তারিখ), Expiry Date (মেয়াদ), Purchase Cost (masked if `!isOwner`), Godown Balance, Dokan Balance, Barcode.
  - Quick action to transfer stock for that specific lot.
  - Quick action to print barcode sticker.

## Verification
- Run `pnpm build` in `frontend/`.
- Ensure 0 errors.

## Reporting
- Commit changes: `feat: implement inventory, godown lot management and barcode sticker ui`
- Write report to: `.superpowers/sdd/pos-inventory-syngenta/task-11-report.md`
- Report back with DONE, commit hash, and test verification output.
