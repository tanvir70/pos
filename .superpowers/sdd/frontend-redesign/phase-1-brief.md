# Phase 1 Brief: Atomic UI Primitives & Core Utilities

**Plan Reference:** Phase 1 from `docs/superpowers/plans/2026-09-17-high-performance-frontend-terminal.md`  
**Spec Reference:** `docs/superpowers/specs/2026-09-17-high-performance-frontend-terminal-design.md`  

---

## Objectives

1. **Integer-Paisa Currency Math (`src/utils/currency.ts`)**:
   - Implement `roundAccounting(amount)` to eliminate IEEE 754 floating-point drift (`0.1 + 0.2 = 0.3`).
   - Implement `toPaisa(bdt)` and `fromPaisa(paisa)` integer converters.
   - Implement `calcLineTotal(quantity, unitPrice)` with symmetrical accounting rounding.
   - Implement `calcDiscount(subtotal, type, value)` supporting flat BDT (`৳`) and percentage (`%`).
   - Implement `calcGrossProfit(sellingPrice, purchaseCost, quantity)` returning `{ profit, marginPct }`.
   - Implement `calcChangeReturn(tendered, payable)` returning change to return $\ge 0$.
   - Implement `formatTk(amount)` with Bengali currency symbol (`৳`) and Indian grouping format (`৳১,৪৫০.০০`).

2. **Hardware Barcode Scanner Wedge Interceptor (`src/utils/barcode.ts`)**:
   - Implement `useBarcodeScanner` React hook capturing rapid keystrokes ($\le 35\text{ms}$ inter-key buffer ending with `Enter`).
   - Prevent barcode strings from leaking into active input fields or buttons.
   - Expose trigger callback `onScan(barcode: string) => void`.

3. **WhatsApp Click-to-Chat Utility (`src/utils/whatsapp.ts`)**:
   - Implement `normalizeBDPhone(phone)` converting domestic mobile numbers (`01...`, `+8801...`, `880 1...`) to international standard `8801XXXXXXXXX`.
   - Implement `generateDueReminderUrl` and `openWhatsAppPaymentReminder` with polite Bengali debt notification and invoice dispatch text.

4. **Atomic Reusable UI Components (`src/components/ui/`)**:
   - `Button.tsx`: High-contrast touch button supporting variants (`primary`, `secondary`, `danger`, `warning`, `outline`, `ghost`, `numpad`), sizes, loading spinner, and icons.
   - `Input.tsx`: Form input with label, error banner, helper text, clear button, monospace numbers, and icon adornments.
   - `Badge.tsx`: Status pills (`success`, `warning`, `danger`, `info`, `purple`, `neutral`) with optional pulsating live dot.
   - `Card.tsx`: Structural surface card with `CardHeader`, `CardBody`, and `CardFooter`.
   - `Modal.tsx`: Accessible dialog with focus trap, backdrop blur, and Escape key handling.
   - `StatCard.tsx`: KPI metric card with color themes, trends, and Owner Mode PIN blur/masking (`[🔒 আনলক]`).
   - `TouchNumpad.tsx`: 3×4 touch calculator (`0-9`, `.`, `00`, `C`, `⌫`) with Quick Cash chips (`Exact`, `+100`, `+500`, `+1000`).
   - `Table.tsx`: High-density tabular layout with `TableHead`, `TableBody`, `TableRow`, `TableHeaderCell`, `TableCell`, `TableEmptyState`, and `TableLoadingState`.
   - `index.ts`: Clean barrel export.

## Verification Requirements
- `pnpm build` in `frontend/` must compile with 0 errors.
- Unit tests must verify that `0.1 + 0.2 === 0.3` under `roundAccounting`.
