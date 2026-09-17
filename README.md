# Syngenta POS & Inventory Management System
### মেসার্স আল-আমিন ট্রেডার্স (সিনজেনটা অনুমোদিত ডিলারশিপ)

A modern, full-stack Point of Sale (POS), Inventory, and Customer Credit Ledger system tailor-made for agrochemical dealerships in Bangladesh. Built with **Spring Boot 3 (Java 21)** and **React 19 (TypeScript + Tailwind CSS v4)**, this application is engineered around real-world rural pesticide dealership realities: carton break-bulk conversions, FEFO chemical expiry management, rush-hour split-stock deductions, negative counter stock allowances, in-line price bargaining overrides, customer debt ledgers with Money Receipt vouchers, damaged chemical quarantine routing, 4-digit Owner PIN protection, and 1-click disaster recovery backups.

---

## 🌾 Business & Domain Highlights

1. **Carton Multipliers & Base Unit Unification**: Agrochemicals are purchased by the carton (e.g. 20 bottles/carton for Amistar Top, 50 packets/carton for Virtako) but sold in loose bottles or packets. All stock in the database is strictly tracked in base units with `NUMERIC(12, 3)` precision, eliminating break-bulk bookkeeping drift.
2. **FEFO (First Expired, First Out) & Scannable 1D Barcodes**: The system prioritizes nearest-expiry lots during checkout, flagging lots expiring within 30 days. Generates on-demand 50mm × 25mm Code 128 thermal barcode labels for loose containers and cartons.
3. **Split-Stock Sales (Dokan & Godown)**: When retail counter shelves run low, cashiers can fulfill an order across **Dokan** (front shop) and **Godown** (bulk warehouse) on a single invoice, automatically logging `DIRECT_WHOLESALE_DISPATCH` audit entries.
4. **Asymmetric Negative Stock Allowance**: Counter staff can ring up newly arrived shipments from the Dokan location before supplier challan paperwork is entered, while Godown bulk storage strictly prohibits negative balances.
5. **In-Line Bargaining Rate Overrides**: Rural agro-dealers negotiate bulk pesticide prices per-farmer. The POS allows instant unit rate adjustments on cart items without altering master catalog prices, tracking exact gross profit margins in real time.
6. **4-Digit Owner PIN Mode (`1234`)**: Prevents counter sales assistants and customers from viewing purchase costs (কেনা দাম) and daily gross profit margins during bargaining. 1-click toggle reveals full margin data for the dealership proprietor.
7. **Customer Credit Ledger & Money Receipt (MR No.)**: Tracks wholesale sub-dealers and retail farmers with credit limits, payment history, and stamped Money Receipt vouchers. Includes 1-click WhatsApp balance notifications with automatic +880 international number formatting.
8. **Direct Receipt-less Returns & Chemical Quarantine**: Rural farmers often misplace paper receipts over 15–30 day spraying cycles. The return counter accepts direct returns, adjusting customer credit balances (`DUE_ADJUSTMENT`), restocking sellable goods to Dokan/Godown, and routing leaking or damaged bottles (`isDamaged = true`) to quarantine storage.
9. **Dual Print Layouts (80mm Thermal & A4 Legal Challan)**: One-click print modal provides fast 80mm cash memos for farmers, and formal A4 Wholesale Delivery Challans with customer ledger statements and dual authorized signature lines.
10. **1-Click Disaster Recovery SQL Backup**: Prominent backup button triggers an immediate browser download of the complete database schema and dataset in SQL format via native JDBC query, requiring zero CLI utilities (`pg_dump`, `mysqldump`) or shell access.

---

## 🏛️ Monorepo Architecture

```
POS & Inventory Prototype/
├── backend/                              # Spring Boot 3.3.3 REST API (Java 21)
│   ├── src/main/java/com/alamin/pos/
│   │   ├── config/                       # Web MVC and CORS configuration
│   │   ├── controller/                   # REST endpoints (/api/products, /api/inventory, etc.)
│   │   ├── dto/                          # Typed request and response DTOs with Bean Validation
│   │   ├── entity/                       # JPA entities mapping the 10 schema tables
│   │   ├── mapper/                       # MapStruct DTO-to-entity mappers
│   │   ├── repository/                   # Spring Data JPA repositories with custom queries
│   │   └── service/                      # Core business logic (Sales, Inventory, Returns, Backup)
│   ├── src/main/resources/
│   │   ├── application.yml               # Production & local development database configuration
│   │   └── db/migration/                 # Flyway migrations (V1 schema, V2 seed data)
│   ├── src/test/                         # Comprehensive unit & E2E integration test suite
│   │   ├── java/com/alamin/pos/e2e/      # SyngentaBusinessFlowTest (8-step dealership flow)
│   │   └── resources/application.yml     # Isolated in-memory H2 test database configuration
│   ├── build.gradle                      # Gradle Groovy build configuration
│   └── gradle.properties                 # Java 21 LTS toolchain pinning
│
├── frontend/                             # React 19 SPA (TypeScript + Vite + Tailwind CSS v4)
│   ├── src/
│   │   ├── api/                          # Native fetch API client with zero runtime dependencies
│   │   ├── components/                   # Reusable UI widgets, modals, barcodes, and print templates
│   │   │   ├── A4InvoicePrint.tsx        # A4 wholesale challan with dual signature blocks
│   │   │   ├── BarcodeStickerModal.tsx   # 50mm x 25mm Code 128 thermal sticker generator
│   │   │   ├── LotSelectorDropdown.tsx   # FEFO-recommended batch selector with cost privacy
│   │   │   ├── Navbar.tsx                # Bilingual header with 1-click backup & Owner PIN
│   │   │   ├── SplitStockModal.tsx       # Dokan vs. Godown stock fulfillment modal
│   │   │   └── ThermalReceipt.tsx        # 80mm POS counter cash memo
│   │   ├── pages/                        # 6 core dealership application views
│   │   │   ├── PosCounter.tsx            # Fast POS sales counter with barcode auto-scan & F2 shortcut
│   │   │   ├── Dashboard.tsx             # Live cash in drawer, sales KPIs & expiring lot alerts
│   │   │   ├── Inventory.tsx             # Product catalog, stock overview & barcode generation
│   │   │   ├── Godown.tsx                # Bulk shipment intake & internal Dokan replenishment
│   │   │   ├── Customers.tsx             # Credit ledger, WhatsApp reminders & MR No. payments
│   │   │   └── Returns.tsx               # Direct return processing with chemical quarantine
│   │   ├── types/                        # Strict TypeScript domain interfaces and DTOs
│   │   ├── App.tsx                       # Main shell mounting active tab and Owner PIN state
│   │   └── index.css                     # Tailwind CSS v4 styles with print stylesheets
│   ├── package.json                      # Frontend dependencies and build scripts
│   └── vite.config.ts                    # Vite 8 config with /api reverse proxy to backend:8080
│
├── .superpowers/sdd/                     # Structured Domain Development (SDD) spec and task reports
├── DECISIONS_LOG.md                      # Complete log of business decisions and technical rationale
└── README.md                             # System overview and setup guide
```

---

## 🛠️ Technology Stack

| Layer | Technologies & Libraries |
| :--- | :--- |
| **Backend Runtime** | Java 21 LTS, Spring Boot 3.3.3 |
| **Persistence & DB** | Spring Data JPA, Hibernate 6.5, Flyway 10, PostgreSQL 10+ (pure enterprise relational database) |
| **Validation & Mapping** | Jakarta Bean Validation, MapStruct 1.6.0, Lombok 1.18.34 |
| **Barcodes** | ZXing Core & JavaSE 3.5.3 (Code 128 1D vector and raster generation) |
| **Build System** | Gradle 8.13 (Groovy DSL) with toolchain pinning |
| **Frontend Framework**| React 19, React DOM 19, TypeScript 5.7 |
| **Frontend Tooling** | Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`), oxfmt |
| **Icons & UI** | Lucide React, Bilingual Bengali & English UI |
| **Architecture** | **Ponytail Principle**: Lean, minimal, zero unnecessary dependencies, native fetch |

---

## 🚀 Getting Started

### Prerequisites
- **Java 21 LTS** (JDK 21 installed and available on `PATH` or configured via `gradle.properties`)
- **PostgreSQL 10+** (running on `localhost:5432` with databases `posdb` and `posdb_test`)
- **Node.js 20+** and **pnpm 9+**

### 1. Running the Backend Service

```bash
# Navigate to backend directory
cd backend

# Build and start the Spring Boot application
./gradlew bootRun
```
- Server starts on `http://localhost:8080` (or `SERVER_PORT=8081 ./gradlew bootRun`)
- Flyway automatically runs database migrations and seeds initial Syngenta products (Amistar Top, Virtako, Refit, Isabion, Karate), lots, customer accounts, and stock balances into PostgreSQL `posdb`
- Tests run against PostgreSQL `posdb_test` via `./gradlew test`

### 2. Running the Frontend Application

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies (if first time)
pnpm install

# Start the Vite development server
pnpm dev
```
- Vite server starts on `http://localhost:5173` (or port assigned by host environment)
- Requests to `/api/*` are automatically proxied to `http://localhost:8080`

### 3. Accessing the System
Open your browser and navigate to `http://localhost:5173` (or the development port displayed by Vite).
- **Default Owner PIN**: `1234` (toggles between Cashier Mode and Admin/Owner Mode via the header button)
- **Keyboard Shortcut**: Press `F2` anywhere on the POS screen to focus payment and complete the sale

---

## 🧪 Testing & Verification

The system includes comprehensive automated testing spanning database migrations, repositories, service layers, controllers, and full end-to-end dealership workflows.

### 1. Backend Verification
```bash
cd backend

# Run the complete test suite (55 tests)
./gradlew test

# Run full package build including jar packaging
./gradlew build
```

#### Test Suite Breakdown:
- `SyngentaBusinessFlowTest`: Complete 8-step dealership integration test verifying the entire operational business flow from shipment arrival to 1-click SQL disaster recovery backup.
- `DashboardAndBackupTest`: Verifies cash in drawer calculation, exact gross margin profit accuracy, expiring lot alerts, low stock alerts, and 1-click SQL backup streaming.
- `CustomerAndReturnTest`: Verifies customer registration, search, debt repayment with Money Receipt (MR No.), receipt-less returns, quarantine routing, and due adjustments.
- `SaleServiceTest`: Verifies split-stock deduction across Dokan/Godown, Dokan negative stock tolerance, Godown negative stock prevention, and unit cost price freezing.
- `InventoryServiceTest`: Verifies carton multiplier conversions, automated Code 128 barcode synthesis, stock transfers between Godown and Dokan, and movement audit logs.
- `BarcodeServiceTest`: Verifies Code 128 PNG image generation and HTTP caching headers.
- `FlywayMigrationTest`: Verifies all 10 schema tables, foreign keys, and seed data.
- `RepositoryTests`: Verifies custom queries and JPA transaction methods.

### 2. Frontend Verification
```bash
cd frontend

# Run production build and type checking
pnpm build
```
- Compiles production bundle cleanly with zero TypeScript or styling errors.

---

## 📋 Database Schema & Entities

The system defines 10 core tables configured with ANSI SQL identity keys (`BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY`), guaranteeing seamless dual compatibility with both embedded H2 and production PostgreSQL:

1. `product`: Agrochemical catalog items with English/Bengali names, carton multiplier, base unit, and alert thresholds.
2. `inventory_lot`: Specific batch lots with manufacturer lot number, expiry date, purchase cost, retail/wholesale prices, and barcode.
3. `stock_inventory`: Location-based inventory balances (`DOKAN` vs. `GODOWN`) per lot in base units (`NUMERIC(12, 3)`).
4. `godown_movement`: Immutable warehouse audit log recording `PURCHASE_ENTRY`, `TRANSFER_TO_DOKAN`, `TRANSFER_TO_GODOWN`, `DIRECT_WHOLESALE_DISPATCH`, and `RETURN_ENTRY`.
5. `customer`: Wholesale sub-dealers and retail farmers with addresses, credit limits, current dues, MFS numbers (bKash/Nagad), and bank details.
6. `customer_ledger`: Financial audit statements tracking `INVOICE_BILL`, `CASH_PAYMENT`, and `RETURN_CREDIT` transactions with Money Receipt (MR No.) references.
7. `sale`: Invoice headers with invoice number (`INV-YYYYMMDD-XXXX`), discount, 1-click round-off, cash/digital paid, and due amount.
8. `sale_item`: Line items capturing frozen unit cost (`unit_cost = lot.purchaseCost`), Dokan quantity, Godown quantity, and line total.
9. `sale_return`: Return vouchers (`RET-YYYYMMDD-XXXX`) with refund type (`CASH_REFUND` or `DUE_ADJUSTMENT`) and customer reference.
10. `sale_return_item`: Returned line items with quarantine flag (`isDamaged`), restock location, and refund rate.

---

## 🔒 Security & Privacy Features

- **Owner PIN Masking**: Default PIN `1234` protects confidential purchase costs (কেনা দাম) and daily gross profit margins. Cashiers can operate the counter and sell without seeing dealer purchase costs.
- **Credit Limit Ceiling Warnings**: Visual progress bars and amber/red alerts display customer credit utilization without rigidly halting peak seasonal field operations.
- **Audit Immutability**: Critical ledger balances, Godown movements, and unit costs are frozen upon transaction creation, preventing retrospective manipulation.

---

## 📄 Decisions & Operational Log
All domain, architectural, and financial decisions taken during system design are documented in [`DECISIONS_LOG.md`](./DECISIONS_LOG.md).
