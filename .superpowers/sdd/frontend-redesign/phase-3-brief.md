# Phase 3 Brief: Modular 60/40 POS Billing Cockpit

**Plan Reference:** Phase 3 from `docs/superpowers/plans/2026-09-17-high-performance-frontend-terminal.md`  
**Spec Reference:** `docs/superpowers/specs/2026-09-17-high-performance-frontend-terminal-design.md`  

---

## Objectives

1. **Decompose Monolithic `PosCounter.tsx` (61KB / 1,348 lines)**:
   - Restructure into dedicated modular components in `src/components/pos/`:
     - `ProductCatalogGrid.tsx`: Left 60% section.
     - `CustomerSelect.tsx`: Customer selector & autocomplete.
     - `CartTicket.tsx`: Active invoice ticket line items.
     - `SettlementPanel.tsx`: Financial summary, tender inputs & checkout.
     - `DualPrintModal.tsx`: Post-checkout 80mm thermal receipt vs A4 invoice preview.
     - `index.ts`: Clean barrel export.

2. **Left 60% Panel (`ProductCatalogGrid.tsx`)**:
   - Fast category filter pills (All, Insecticide, Fungicide, Herbicide, Growth Enhancer, Seed).
   - Instant search bar with `F2` keyboard shortcut and barcode autofocus indicator.
   - High-contrast product touch cards with store stock badge (in stock, low stock warning, out of stock), FEFO lot expiry, and retail/wholesale pricing.
   - Tap-to-add action calling `addToCart`.

3. **Right 40% Panel Components**:
   - **`CustomerSelect.tsx`**:
     - Walk-in customer 1-click default.
     - Search input with autocomplete dropdown showing customer name, phone, type (`RETAIL` / `WHOLESALE`), and outstanding due balance.
   - **`CartTicket.tsx`**:
     - Zero-vertical-scroll ticket list with smooth inner scrolling.
     - Line items showing Bengali and English titles, packaging base unit, and line total.
     - Integrated `LotSelectorDropdown.tsx` for 1-click manual lot switching.
     - Inline bargaining price editor (`✏️`) with visual amber badge indicator for modified prices.
     - Integer and decimal quantity stepper (`-`, manual input, `+`).
     - Owner Mode indicators displaying purchase cost and live profit per line item.
   - **`SettlementPanel.tsx`**:
     - Subtotal, discount mode (% / flat), 1-click round-off button (`⚡ বাদ দিন`).
     - Net Payable in oversized high-contrast bold font.
     - Payment method selector tabs (`CASH`, `BKASH`, `NAGAD`, `DUE`, `BANK_TRANSFER`).
     - Cash tendered input with Quick Cash chips (`Exact`, `+100`, `+500`, `+1000`).
     - Live Due and Change to Return badges.
     - Complete Sale button with `F9` keyboard shortcut and loading state.

4. **Post-Checkout Dialog (`DualPrintModal.tsx`)**:
   - Modal launched upon successful sale completion.
   - Summary of invoice number, total paid, change returned, and remaining due.
   - 1-Click buttons for:
     - 80mm Thermal Receipt (`ThermalReceipt.tsx`)
     - A4 Wholesale Invoice (`A4InvoicePrint.tsx`)
     - WhatsApp invoice dispatch via `openWhatsAppPaymentReminder`
     - Start New Sale (`Esc`).

5. **Hardware Barcode Interception in `PosCounter.tsx`**:
   - Wire `useBarcodeScanner` at the page level to match incoming scans against available stocks/lots, automatically adding them to the cart without user focus disruption.

## Verification Requirements
- `pnpm build` must pass with 0 errors.
- Monolithic `PosCounter.tsx` must be reduced to a clean parent coordinator.
- Hardware barcode interception must correctly identify products and lots.
