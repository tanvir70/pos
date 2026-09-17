# Agrochemical POS & Inventory Web System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready, bulletproof Web-based POS and Warehouse Inventory Management system specifically tailored for agricultural dealerships (pesticides, fungicides, herbicides, fertilizers, and seeds) in a clean monorepo architecture (Spring Boot 3 + React 19 / Tailwind CSS v4) within a 15-day / 15,000 BDT budget.

**Architecture:** Monorepo consisting of `backend/` (Spring Boot 3 REST API in Java 21 with Spring Data JPA and Flyway) and `frontend/` (React 19 + Vite + Tailwind CSS v4 single-page app refactored from existing prototype). Incorporates the 7 bulletproof operational rules: base unit stock storage with carton multipliers, negative stock allowance, FEFO/manual lot dispatch, line-item price overrides for bargaining, direct returns without receipts, round-off change adjustments, and 1-click database backup.

**Tech Stack:** Java 21, Spring Boot 3.3+, Spring Data JPA, Flyway, PostgreSQL (or H2 embedded for testing), ZXing Barcode Library, React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons.

**Spec:** [`docs/superpowers/specs/2026-09-16-pos-inventory-web-design.md`](file:///home/tanvirar/Desktop/POS%20&%20Inventory%20Prototype/docs/superpowers/specs/2026-09-16-pos-inventory-web-design.md)

## Global Constraints

- Target Environment: Web-hosted application (Cloud VPS / Server) accessible from any browser on shop PCs, laptops, and mobile.
- Backend runtime: Java 21 LTS with Gradle (Groovy DSL `build.gradle`).
- Mappers & Boilerplate: MapStruct 1.6+ and Lombok with `lombok-mapstruct-binding`.
- Decimal precision: All stock quantities and units must use `BigDecimal` / `NUMERIC(12, 3)` (base units: bottles/packets/kg/liter).
- Currency / Prices: All prices and monetary totals must use `BigDecimal` / `NUMERIC(12, 2)` (BDT `৳`).
- Lot Dispatch: Must default to FEFO (First Expired, First Out) with 1-click manual override per cart item.
- Role/Privacy Control: 4-digit Owner PIN toggles Admin Mode vs. Cashier Mode, hiding purchase cost and gross profit from counter salesboys.
- Product Search: Unified query matching English name, Bengali name, product code, and barcode.
- Discounting: Cart supports both Flat Taka (`৳`) and Percentage (`%`) discounts, plus Round-Off adjustment.
- Bilingual Support: UI labels and product names support both Bengali (*Noto Sans Bengali*) and English.
- Printing: Retail sales support 80mm/58mm thermal receipts; Wholesale and Godown dispatches support full-page A4 Order Invoices.
- Frontend: Refactor and wire the existing `src/App.tsx` prototype into modular pages rather than writing UI from scratch.

---

### Task 1: Monorepo Scaffolding & Directory Setup

**Files:**
- Create: `backend/build.gradle` (Groovy DSL)
- Create: `backend/settings.gradle`
- Create: `backend/src/main/resources/application.yml`
- Create: `backend/src/main/java/com/alamin/pos/PosApplication.java`
- Modify: `frontend/package.json` (move current React app into `frontend/`)
- Test: `backend/src/test/java/com/alamin/pos/PosApplicationTests.java`

**Interfaces:**
- Produces: Runnable Spring Boot 3 application context with Gradle, web, JPA, MapStruct, Lombok, and H2/PostgreSQL dependencies.

- [ ] **Step 1: Create the `backend/` Gradle project directory structure**
- [ ] **Step 2: Write `backend/build.gradle` and `backend/settings.gradle`** with Groovy DSL including Spring Boot 3.3+, Spring Web, JPA, Flyway, H2, PostgreSQL, ZXing, Lombok, MapStruct, and `lombok-mapstruct-binding`.
- [ ] **Step 3: Write `backend/src/main/resources/application.yml`** configured for local development with Flyway enabled.
- [ ] **Step 4: Write `PosApplication.java` entrypoint and `PosApplicationTests.java` context loads test**.
- [ ] **Step 5: Move frontend files (`src/`, `index.html`, `vite.config.ts`, `package.json`) into `frontend/`**.
- [ ] **Step 6: Run `./gradlew test` in `backend/` to verify Spring Boot boots clean**.
- [ ] **Step 7: Run `pnpm dev` in `frontend/` to verify Vite builds**.

---

### Task 2: Database Schema & Flyway Migration (The Bulletproof Core)

**Files:**
- Create: `backend/src/main/resources/db/migration/V1__init_schema.sql`
- Create: `backend/src/main/resources/db/migration/V2__seed_data.sql`
- Test: `backend/src/test/java/com/alamin/pos/migration/FlywayMigrationTest.java`

**Interfaces:**
- Produces: Complete database schema with tables: `product`, `inventory_lot`, `stock_inventory`, `godown_movement`, `customer`, `customer_ledger`, `sale`, `sale_item`, `sale_return`, `sale_return_item`.

- [ ] **Step 1: Write `V1__init_schema.sql`** with the 10 bulletproof tables including carton multipliers, round-off, and nullable original invoice IDs for direct returns.
- [ ] **Step 2: Write `V2__seed_data.sql`** with popular agrochemical products (*Amistar Top 325 SC, Virtako 40 WG, Refit 500 EC, Isabion, Karate 2.5 EC*) with initial lots and prices.
- [ ] **Step 3: Write `FlywayMigrationTest.java`** verifying migration and seeding runs cleanly.
- [ ] **Step 4: Run `./gradlew test --tests FlywayMigrationTest`**.

---

### Task 3: JPA Entities & Spring Data Repositories

**Files:**
- Create: `backend/src/main/java/com/alamin/pos/entity/Product.java`
- Create: `backend/src/main/java/com/alamin/pos/entity/InventoryLot.java`
- Create: `backend/src/main/java/com/alamin/pos/entity/StockInventory.java`
- Create: `backend/src/main/java/com/alamin/pos/entity/GodownMovement.java`
- Create: `backend/src/main/java/com/alamin/pos/entity/Customer.java`
- Create: `backend/src/main/java/com/alamin/pos/entity/CustomerLedger.java`
- Create: `backend/src/main/java/com/alamin/pos/entity/Sale.java`
- Create: `backend/src/main/java/com/alamin/pos/entity/SaleItem.java`
- Create: `backend/src/main/java/com/alamin/pos/entity/SaleReturn.java`
- Create: `backend/src/main/java/com/alamin/pos/entity/SaleReturnItem.java`
- Create: `backend/src/main/java/com/alamin/pos/repository/*Repository.java`
- Test: `backend/src/test/java/com/alamin/pos/repository/RepositoryTests.java`

**Interfaces:**
- Produces: Type-safe JPA entity mappings with custom repository queries (e.g. `findActiveLotsByProductIdOrderByExpiryDateAsc` for FEFO).

- [ ] **Step 1: Write all JPA Entities** with Lombok and validation.
- [ ] **Step 2: Write Spring Data Repositories** for all entities.
- [ ] **Step 3: Write repository integration test in `RepositoryTests.java`**.
- [ ] **Step 4: Run `./gradlew test --tests RepositoryTests`**.

---

### Task 4: Inventory & Godown Lot Management Service (With Base Unit Conversion)

**Files:**
- Create: `backend/src/main/java/com/alamin/pos/dto/LotEntryRequest.java`
- Create: `backend/src/main/java/com/alamin/pos/dto/StockTransferRequest.java`
- Create: `backend/src/main/java/com/alamin/pos/service/InventoryService.java`
- Create: `backend/src/main/java/com/alamin/pos/controller/InventoryController.java`
- Test: `backend/src/test/java/com/alamin/pos/service/InventoryServiceTest.java`

**Interfaces:**
- Produces:
  - `recordLotEntry`: Takes quantity in cartons or base bottles, converts via multiplier, and adds to Godown with `entry_date` and `purchase_cost`.
  - `transferStock`: Transfers base quantity from Godown to Dokan.

- [ ] **Step 1: Write failing unit test in `InventoryServiceTest`** verifying carton-to-bottle conversion upon lot arrival and Godown->Dokan transfer.
- [ ] **Step 2: Implement `InventoryService.java`** handling atomic stock increments/decrements.
- [ ] **Step 3: Implement `InventoryController.java`** exposing `/api/inventory/lots`, `/api/inventory/transfer`, and `/api/inventory/stock`.
- [ ] **Step 4: Run `./gradlew test --tests InventoryServiceTest` to verify PASS**.

---

### Task 5: ZXing Barcode Generation Engine

**Files:**
- Create: `backend/src/main/java/com/alamin/pos/service/BarcodeService.java`
- Create: `backend/src/main/java/com/alamin/pos/controller/BarcodeController.java`
- Test: `backend/src/test/java/com/alamin/pos/service/BarcodeServiceTest.java`

**Interfaces:**
- Produces:
  - `generateBarcodeImage(String barcodeText, int width, int height)`: Returns PNG image bytes.
  - `GET /api/barcode/{barcode}`: Renders barcode graphic.

- [ ] **Step 1: Write failing test in `BarcodeServiceTest`**.
- [ ] **Step 2: Implement `BarcodeService.java`** using ZXing `Code128Writer`.
- [ ] **Step 3: Implement `BarcodeController.java`**.
- [ ] **Step 4: Run `./gradlew test --tests BarcodeServiceTest` to verify PASS**.

---

### Task 6: POS Sales Engine (Split-Stock, Negative Stock, Price Override, Round-off)

**Files:**
- Create: `backend/src/main/java/com/alamin/pos/dto/SaleRequest.java`
- Create: `backend/src/main/java/com/alamin/pos/dto/SaleResponse.java`
- Create: `backend/src/main/java/com/alamin/pos/service/SaleService.java`
- Create: `backend/src/main/java/com/alamin/pos/controller/SaleController.java`
- Test: `backend/src/test/java/com/alamin/pos/service/SaleServiceTest.java`

**Interfaces:**
- Produces:
  - `processSale`: Handles split Dokan/Godown deduction, allows negative stock if configured, applies line price overrides, applies round-off, freezes lot `unit_cost` for profit, updates customer dues.

- [ ] **Step 1: Write failing test in `SaleServiceTest`** covering:
  - Split deduction (4 from Dokan + 6 from Godown).
  - Negative stock sale when Dokan stock is 0.
  - Line-item price override (e.g. ৳150 overridden to ৳145) and round-off (৳3 discount).
  - Exact gross profit calculation.
- [ ] **Step 2: Implement `SaleService.java`** with `@Transactional` ACID boundaries.
- [ ] **Step 3: Implement `SaleController.java`**.
- [ ] **Step 4: Run `./gradlew test --tests SaleServiceTest` to verify PASS**.

---

### Task 7: Customer Due Ledger & Direct Returns

**Files:**
- Create: `backend/src/main/java/com/alamin/pos/dto/CustomerPaymentRequest.java`
- Create: `backend/src/main/java/com/alamin/pos/dto/DirectReturnRequest.java`
- Create: `backend/src/main/java/com/alamin/pos/service/CustomerService.java`
- Create: `backend/src/main/java/com/alamin/pos/service/SaleReturnService.java`
- Create: `backend/src/main/java/com/alamin/pos/controller/CustomerController.java`
- Create: `backend/src/main/java/com/alamin/pos/controller/SaleReturnController.java`
- Test: `backend/src/test/java/com/alamin/pos/service/CustomerAndReturnTest.java`

**Interfaces:**
- Produces:
  - `CustomerService.recordPayment`: Cash repayment credited to due balance.
  - `SaleReturnService.processDirectReturn`: Direct return without invoice, restocked to Dokan/Godown, refunded as cash or credit.

- [ ] **Step 1: Write failing test in `CustomerAndReturnTest`** for payment recording and direct return without invoice.
- [ ] **Step 2: Implement `CustomerService.java` and `SaleReturnService.java`**.
- [ ] **Step 3: Implement controllers `CustomerController.java` and `SaleReturnController.java`**.
- [ ] **Step 4: Run `./gradlew test --tests CustomerAndReturnTest` to verify PASS**.

---

### Task 8: Dashboard & 1-Click Database Backup Engine

**Files:**
- Create: `backend/src/main/java/com/alamin/pos/dto/DashboardSummaryDto.java`
- Create: `backend/src/main/java/com/alamin/pos/service/DashboardService.java`
- Create: `backend/src/main/java/com/alamin/pos/service/BackupService.java`
- Create: `backend/src/main/java/com/alamin/pos/controller/DashboardController.java`
- Create: `backend/src/main/java/com/alamin/pos/controller/BackupController.java`
- Test: `backend/src/test/java/com/alamin/pos/service/DashboardAndBackupTest.java`

**Interfaces:**
- Produces:
  - `DashboardService.getSummary`: Total sales, exact gross profit, cash in drawer, market dues, expiring-soon alerts (<30 days).
  - `BackupService.exportBackup`: Streams complete database backup file for immediate download to USB/disk.

- [ ] **Step 1: Write failing test in `DashboardAndBackupTest`**.
- [ ] **Step 2: Implement `DashboardService.java` and `BackupService.java`**.
- [ ] **Step 3: Implement `DashboardController.java` and `BackupController.java`**.
- [ ] **Step 4: Run `./gradlew test --tests DashboardAndBackupTest` to verify PASS**.

---

### Task 9: Frontend API Client & Refactored Component Architecture

**Files:**
- Create: `frontend/src/types/index.ts`
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/endpoints.ts`
- Refactor: `frontend/src/components/Navbar.tsx` (adds 1-click DB Backup button)

- [ ] **Step 1: Define TypeScript interfaces matching backend DTOs**.
- [ ] **Step 2: Implement Axios API client in `frontend/src/api/client.ts`**.
- [ ] **Step 3: Build `Navbar.tsx` with bilingual tabs and the 1-Click Backup button**.

---

### Task 10: Refactor POS Billing Counter (Split-Stock, Lot Override & Dual Print)

**Files:**
- Refactor: `frontend/src/pages/PosCounter.tsx` (from `App.tsx` sales counter)
- Create: `frontend/src/components/LotSelectorDropdown.tsx`
- Create: `frontend/src/components/SplitStockModal.tsx`
- Refactor: `frontend/src/components/ThermalReceipt.tsx` (80mm print)
- Create: `frontend/src/components/A4InvoicePrint.tsx` (Wholesale A4 order print)

- [ ] **Step 1: Refactor `PosCounter.tsx`** to connect to live `/api/sales` and `/api/products` endpoints.
- [ ] **Step 2: Add line-item price override and Round-Off field in cart**.
- [ ] **Step 3: Add `LotSelectorDropdown.tsx`** showing FEFO smart default with 1-click manual override.
- [ ] **Step 4: Add `SplitStockModal.tsx`** for 1-click Godown deficit fulfillment.
- [ ] **Step 5: Integrate `ThermalReceipt.tsx` and `A4InvoicePrint.tsx`** with print triggers.

---

### Task 11: Inventory, Godown Lots & Barcode Stickers UI

**Files:**
- Create: `frontend/src/pages/Inventory.tsx`
- Create: `frontend/src/pages/Godown.tsx`
- Create: `frontend/src/components/LotEntryModal.tsx`
- Create: `frontend/src/components/StockTransferModal.tsx`
- Create: `frontend/src/components/BarcodeStickerModal.tsx`

- [ ] **Step 1: Build `Inventory.tsx`** displaying agrochemical products with carton multipliers and stock levels.
- [ ] **Step 2: Build `Godown.tsx`** with lot entry dates, expiry dates, and movement logs.
- [ ] **Step 3: Build `LotEntryModal.tsx` and `StockTransferModal.tsx`**.
- [ ] **Step 4: Build `BarcodeStickerModal.tsx`** displaying printable barcode labels.

---

### Task 12: Customer Due Ledger, Direct Returns & Analytics Dashboard UI

**Files:**
- Create: `frontend/src/pages/Customers.tsx`
- Create: `frontend/src/pages/Returns.tsx`
- Create: `frontend/src/pages/Dashboard.tsx`
- Modify: `frontend/src/App.tsx` (wires all pages into a clean view)

- [ ] **Step 1: Build `Customers.tsx`** showing customer dues with cash repayment modal.
- [ ] **Step 2: Build `Returns.tsx`** supporting direct chemical returns without receipts.
- [ ] **Step 3: Build `Dashboard.tsx`** showing Today's Revenue, Exact Gross Profit, Cash in Drawer, and Expiring-Soon warnings.
- [ ] **Step 4: Wire all components into `frontend/src/App.tsx`**.

---

### Task 13: End-to-End System Integration Test & Verification

**Files:**
- Create: `backend/src/test/java/com/alamin/pos/e2e/BusinessFlowIntegrationTest.java`
- Modify: `README.md`

- [ ] **Step 1: Write `BusinessFlowIntegrationTest.java`** verifying:
  - Receiving 2 cartons of Amistar Top (40 bottles at ৳135 cost, entry date logged).
  - Transferring 10 bottles to Dokan.
  - Selling 15 bottles (10 from Dokan + 5 from Godown) with ৳10 round-off.
  - Direct customer return of 1 bottle to Dokan.
  - Verifying gross profit and customer due balances.
  - Verifying database backup endpoint.
- [ ] **Step 2: Run `./gradlew build` in `backend/`**.
- [ ] **Step 3: Run `pnpm build` in `frontend/`**.
- [ ] **Step 4: Update `README.md` with 1-step launch instructions**.
