# High-Performance Frontend Terminal Implementation Plan

> **Plan Document:** `docs/superpowers/plans/2026-09-17-high-performance-frontend-terminal.md`  
> **Spec Reference:** `docs/superpowers/specs/2026-09-17-high-performance-frontend-terminal-design.md`  
> **Date:** 2026-09-17  
> **Target Environment:** Counter POS Terminal & Laptop ($1366 \times 768$ up to 1080p Desktop)  
> **Tech Stack:** React 19 + TypeScript 5.7 + Vite 8 + Tailwind CSS v4  

---

## Executive Summary

This plan outlines the complete frontend architectural redesign of the **Al-Amin Traders (মেসার্স আল-আমিন ট্রেডার্স) POS Terminal & Inventory Cockpit**. Following Decision 61 (complete elimination of the Godown warehouse subsystem), the frontend is restructured into a single store inventory (`DOKAN`) plus isolated `QUARANTINE` workflow. The user experience is elevated to a high-speed, zero-lag 60/40 cockpit with sub-16ms renders, integer paisa precision, session persistence, and hardware scanner wedge interception.

---

## Phase Breakdown

### Phase 1: Atomic UI Primitives & Core Utilities
- **Goal**: Establish the atomic component library and mathematical/hardware foundation.
- **Components & Utils**:
  - `src/utils/currency.ts`: Fixed-point paisa rounding, line totals, discounts, gross profit, and change return.
  - `src/utils/barcode.ts`: Hardware barcode wedge timing hook ($\le 35\text{ms}$ burst buffer).
  - `src/utils/whatsapp.ts`: Phone number normalization and Bengali Click-to-Chat payment reminders.
  - `src/components/ui/`: `Button`, `Input`, `Badge`, `Card`, `Modal`, `StatCard`, `TouchNumpad`, `Table`, `index.ts`.

### Phase 2: Global State & Security Contexts
- **Goal**: Implement centralized state engines for authentication, notifications, and billing cart.
- **Components & Contexts**:
  - `src/context/AuthContext.tsx`: Cashier auto-session (`ROLE_CASHIER`), 4-digit Owner PIN escalation (`ROLE_OWNER`), 5-min inactivity auto-lock, and accessible PIN modal.
  - `src/context/ToastContext.tsx`: Stacked high-contrast notification toasts with automatic Bengali error translation.
  - `src/context/CartContext.tsx`: Memoized POS cart with continuous `sessionStorage` auto-save, FEFO lot assignment, bargaining price overrides, and 1-click round-off.
  - `src/api/client.ts`: Token injection, auto-reauth handling, and `X-Idempotency-Key` UUID generation.

### Phase 3: Modular 60/40 POS Billing Cockpit
- **Goal**: Refactor `PosCounter.tsx` (61KB monolith) into a modular, zero-vertical-scroll counter cockpit.
- **Components**:
  - `src/components/pos/ProductCatalogGrid.tsx`: Left 60% panel with category filter pills, search bar (`F2` shortcut), and touch cards.
  - `src/components/pos/CustomerSelect.tsx`: Walk-in customer shortcut, autocomplete search, and due indicators.
  - `src/components/pos/CartTicket.tsx`: Active ticket list, inline bargaining price editor, lot selector, and owner margin hints.
  - `src/components/pos/SettlementPanel.tsx`: Payment methods, quick cash chips (`Exact`, `+100`, `+500`, `+1000`), live change return, and `F9` checkout hotkey.
  - `src/components/pos/DualPrintModal.tsx`: Post-checkout 80mm thermal slip, A4 wholesale invoice, and WhatsApp share.
  - `src/pages/PosCounter.tsx`: Clean parent orchestration component.

### Phase 4: Store Inventory & Quarantine Chemical Disposal
- **Goal**: Modernize catalog and store inventory management, integrating damaged chemical quarantine write-offs.
- **Components**:
  - `src/pages/Inventory.tsx`: Two tabs—"দোকান স্টক (Dokan Stock)" and "কোয়ারেন্টাইন (Quarantine Damaged Goods)".
  - `src/components/LotEntryModal.tsx`: Carton multiplier auto-conversion intake.
  - `src/components/BarcodeStickerModal.tsx`: Thermal 1D Code 128 label sticker generator.
  - Quarantine Disposal Workflow: Owner-authorized write-off modal calling `POST /api/inventory/quarantine/dispose`.

### Phase 5: Verification, Benchmarking & Production Polish
- **Goal**: Full automated test verification, bundle performance audit, and comprehensive documentation.
- **Deliverables**:
  - Automated Node.js precision test suite (`src/tests/phase2-contexts.test.ts`).
  - Production Vite build verification ($\le 200\text{ms}$).
  - Documentation of all SDD briefs, reports, and architecture ledger.
