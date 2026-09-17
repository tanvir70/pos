# Phase 4 Brief: Store Inventory & Quarantine Chemical Disposal

**Plan Reference:** Phase 4 from `docs/superpowers/plans/2026-09-17-high-performance-frontend-terminal.md`  
**Spec Reference:** `docs/superpowers/specs/2026-09-17-high-performance-frontend-terminal-design.md`  

---

## Objectives

1. **Remove Obsolete Godown & Multi-Location Artifacts**:
   - Clean out all obsolete references to Godown, split stocks, and transfer modals from `src/pages/Inventory.tsx`.
   - Update terminology to single store inventory (`DOKAN`).

2. **Dual-Tab Interface Architecture (`src/pages/Inventory.tsx`)**:
   - **Tab 1: দোকান স্টক ও ক্যাটালগ (Dokan Stock & Catalog)**:
     - KPI StatCards: Total Registered SKUs, Total Dokan Stock Units, Low Stock Alert Count, Inventory Valuation at Purchase Cost (masked with `[🔒 আনলক]` unless in Owner Mode).
     - Inline Add Product Form: Code, Bengali/English names, category, base unit, carton multiplier, retail/wholesale prices, min stock alert.
     - Search & Category Filter bar with quick "⚠️ কম স্টক" toggle.
     - High-density `Table` displaying product details, packaging multipliers, store in-stock status, prices, purchase cost (owner mode), and actions.
     - Expandable lot accordion displaying FEFO lot breakdown, expiry dates, and barcodes.
     - Integrated `LotEntryModal.tsx` for bulk carton intake with auto-multiplication.
     - Integrated `BarcodeStickerModal.tsx` for thermal Code 128 sticker prints.
   - **Tab 2: কোয়ারেন্টাইন ও ড্যামেজ কেমিক্যাল (Quarantine & Damage Chemical Stock)**:
     - Overview banner showing total potential financial loss value (`totalLossValue`).
     - Quarantined items table with Lot #, Expiry Date, Supplier, Damaged quantity, and Loss value.
     - Write-off disposal button:
       - If clicked by Cashier, prompts Owner PIN modal via `openPinModal()`.
       - If Owner Mode is active, opens confirmation dialog with disposal types (`WRITE_OFF`, `SUPPLIER_CLAIM`, `DESTROYED`) and remarks.
       - Dispatches request to `POST /api/inventory/quarantine/dispose` and logs success toast.

3. **Domain Types & API Endpoints**:
   - Add `QuarantineStockItem` and `QuarantineDisposalRequest` to `src/types/index.ts`.
   - Add `getQuarantineStock` and `disposeQuarantineStock` to `src/api/endpoints.ts`.

## Verification Requirements
- `pnpm build` must pass with 0 errors.
- Quarantine API endpoints must correctly communicate with backend RBAC security.
- Inventory valuation and cost columns must be masked in Cashier Mode and revealed in Owner Mode.
