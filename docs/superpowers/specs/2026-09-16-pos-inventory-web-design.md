# System Architecture & Technical Design: Agrochemical POS & Inventory Web Application

**Date:** 2026-09-16  
**Status:** Approved  
**Target Environment:** Local Network / Web Application (Up to 3 Laptops + Owner Mobile)  
**Budget & Timeline:** 15,000 BDT / 15 Days  
**Primary Tech Stack:** Spring Boot 3 (Java 21) Backend + React 19 / Vite / Tailwind CSS v4 Frontend (Clean Monorepo)

---

## 1. Executive Summary

This system is a full-featured, bulletproof Wholesale & Retail Point-of-Sale (POS) and Warehouse Inventory Management system specifically engineered for **Agrochemical Dealerships (Pesticides, Insecticides, Fungicides, Herbicides, Fertilizers, and Seeds)** in Bangladesh.

The application runs as a **monorepo web application**:
- **Backend:** Spring Boot 3 REST API managing agrochemical lots, base unit stock conversions, multi-location inventory (Godown vs Dokan), seasonal customer credit ledgers, barcode generation, database backup, and gross profit reporting.
- **Frontend:** React 19 + Vite + Tailwind CSS v4 single-page application (refactored and extended from the existing prototype in this repo) with bilingual support (Bangla & English), fast keyboard-first POS counter, and responsive layouts.
- **Access Model:** Hosted on a primary laptop/PC in the store (or cloud VPS), accessible simultaneously by up to 3 laptops (cashiers/office) and mobile devices via standard web browsers (Chrome / Edge).

---

## 2. Core Operational Workflows & Business Rules (The 7 Bulletproof Rules)

### 2.1 Base Unit Storage & Master Carton Conversion
- All stock in the database is tracked strictly at the **lowest base unit** (`BOTTLE`, `PACKET`, `KG`, `LITER`).
- Cartons / Boxes are treated as **purchase and wholesale multipliers**:
  - *Example:* 1 Carton of *Karate 2.5 EC* = 20 Bottles.
  - Receiving 2 Cartons into Godown $\rightarrow$ database stock atomically increments by `+40 Bottles`.
  - Selling 1 Carton wholesale $\rightarrow$ database stock decrements by `-20 Bottles` at the carton wholesale rate.
  - This eliminates manual break-bulk bookkeeping completely.

### 2.2 Allow Negative Stock (Configurable Store Floor Reality)
- When a new shipment arrives during a busy evening rush, the cashier must be able to ring up sales before the owner has finished typing the supplier challan into the system.
- Configurable setting: `[x] Allow Negative Stock Sales`.
- Stock drops to negative (e.g. `-2`, styled with a distinct red badge). When the incoming challan (`+20`) is entered later, the stock auto-reconciles to `+18`.

### 2.3 Dynamic Cost Fluctuation & Flexible Lot Dispatch (FEFO / Manual)
- Every incoming lot arriving in the Godown records its exact `entry_date`, `purchase_cost`, `lot_number`, and `expiry_date`.
- **Smart FEFO Default:** System auto-suggests the lot nearing expiry first.
- **1-Click Manual Override:** Cashier can override the lot from a quick dropdown on the cart line if they physically hold a different batch.
- **Accurate Profit:** Invoice freezes the specific lot's `purchase_cost` (`profit = (sold_price - lot_cost) * qty`).

### 2.4 Cart Price Overrides & Bargaining Support
- To accommodate local wholesale bargaining without corrupting master catalogs, cashiers can enter a **Line-Item Price Override or Discount** directly in the cart row.
- The UI displays the cost price to the cashier to prevent accidental sales below purchase cost.

### 2.5 Multi-Location Stock (Dokan vs. Godown) & Split-Fulfillment
- **Godown (গুদাম - Warehouse):** Bulk stock received with explicit entry dates.
- **Dokan (দোকান - Retail Shop / Counter):** Floor stock for daily walk-ins.
- **Split-Fulfillment Prompt:** When a customer requests more items than Dokan has in stock:
  - System prompts: *"Dokan has 5. Fulfill remaining 5 from Godown? [Accept]"*.
  - On sale completion, 5 decrements from `DOKAN` and 5 from `GODOWN` on a single invoice without requiring gate passes.

### 2.6 Dual Printing Architecture
1. **Retail Sales:** Standard thermal receipt printing (80mm / 58mm roll) via browser `@media print` with `--kiosk-printing` support.
2. **Wholesale & Godown Dispatches:** Proper full-page **A4 Order Invoice / Challan** print with company header, dealer details, itemized table, previous due, amount paid, remaining balance, and signature lines.

### 2.7 Direct Sales Returns (Without Forcing Original Receipt)
- Customers returning unopened chemicals can be processed via **Direct Return** even if the original paper invoice is lost.
- Items can be restocked to `DOKAN` or `GODOWN`, with refunds issued in cash or credited to the customer's due ledger.

### 2.8 Round-Off (বাট্টা) & Petty Dues Prevention
- A 1-click **Round Off** field at checkout zeroes out loose change (e.g. rounding ৳1,853 down to ৳1,850), preventing customer accounts from accumulating trivial dues.

### 2.9 Seasonal Customer Credit Ledger (বাকির খাতা)
- Immutable double-entry ledger tracking credit sales, repayments, and returns.
- Running balance computed per customer with date-filtered payment histories.

### 2.10 1-Click Database Backup
- A 1-click **"Backup Database"** button in the Navbar exports a complete `.sql` dump to a USB pendrive or local folder, protecting the business from power outages and hardware failure.

---

## 3. Monorepo Architecture & Directory Structure

```
pos-inventory-system/
├── backend/                             # Spring Boot 3 REST API (Java 21)
│   ├── mvnw / mvnw.cmd / pom.xml
│   ├── src/main/
│   │   ├── java/com/alamin/pos/
│   │   │   ├── config/                  # WebMvc, FileStorage, Cors
│   │   │   ├── controller/              # Product, Lot, Sale, Stock, Customer, Dashboard, Backup
│   │   │   ├── dto/                     # Request/Response payloads
│   │   │   ├── entity/                  # JPA Entity Models
│   │   │   │   ├── Product.java         # Master Catalog
│   │   │   │   ├── InventoryLot.java    # Lot with Entry Date, Expiry & Cost
│   │   │   │   ├── StockInventory.java  # Qty in DOKAN vs GODOWN per lot
│   │   │   │   ├── GodownMovement.java  # Date-wise entry/exit audit log
│   │   │   │   ├── Customer.java        # Wholesale/Retail Profiles
│   │   │   │   ├── CustomerLedger.java  # Accounts Receivable Ledger
│   │   │   │   ├── Sale.java            # Invoice Master
│   │   │   │   ├── SaleItem.java        # Split qty & frozen cost snapshot
│   │   │   │   ├── SaleReturn.java      # Return Header
│   │   │   │   └── SaleReturnItem.java  # Returned items & restock location
│   │   │   ├── repository/              # Spring Data JPA Repositories
│   │   │   └── service/                 # Core domain services
│   │   │       ├── BarcodeService.java  # ZXing Barcode Generation
│   │   │       ├── InventoryService.java# Atomic Multi-location Stock Movement
│   │   │       ├── SaleService.java     # Billing & Split-Allocation
│   │   │       ├── CustomerService.java # Ledger & Due Calculations
│   │   │       ├── DashboardService.java# Analytics & Profit Engine
│   │   │       └── BackupService.java   # 1-Click Database Backup
│   │   └── resources/
│   │       ├── db/migration/            # Flyway SQL scripts (V1__init.sql)
│   │       └── application.yml
│   └── uploads/products/                # Product photos storage directory
│
├── frontend/                            # React 19 + Vite + Tailwind CSS v4
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── src/                             # Refactored & extended from current prototype
│       ├── api/                         # Axios API client functions
│       ├── components/
│       │   ├── Navbar.tsx               # Top navigation with Backup button
│       │   ├── ThermalReceipt.tsx       # 80mm/58mm CSS print template
│       │   ├── A4InvoicePrint.tsx       # Wholesale A4 Order Print template
│       │   ├── BarcodeStickerModal.tsx  # Printable barcode sticker generator
│       │   ├── LotSelectorDropdown.tsx  # Manual lot picker per cart row
│       │   ├── SplitStockPrompt.tsx     # Dokan/Godown deficit warning
│       │   └── DateRangeFilter.tsx      # Reusable date selector
│       ├── pages/
│       │   ├── PosCounter.tsx           # Cashier billing counter with F1/F2 shortcuts
│       │   ├── Dashboard.tsx            # Visual analytics & metric cards
│       │   ├── Inventory.tsx            # Agrochemical products, lots, entry dates & barcodes
│       │   ├── Godown.tsx               # Warehouse lots, entry date tracking & shop transfers
│       │   ├── Customers.tsx            # Wholesale accounts, ledger & purchase history
│       │   └── Returns.tsx              # Sales returns (with or without invoice)
│       ├── types/                       # TypeScript interfaces
│       ├── App.tsx                      # App routing & context
│       └── index.css                    # Tailwind CSS v4 & custom frost theme
└── README.md
```

---

## 4. Bulletproof Relational Database Schema

```sql
-- 1. Product Master (Agrochemical Catalog)
CREATE TABLE product (
    id BIGSERIAL PRIMARY KEY,
    product_code VARCHAR(50) NOT NULL UNIQUE,
    name_en VARCHAR(255) NOT NULL, -- e.g. "Amistar Top 325 SC"
    name_bn VARCHAR(255) NOT NULL, -- e.g. "অ্যামিস্টার টপ ৩২৫ এসসি"
    company_name VARCHAR(150) DEFAULT 'Agro Chem',
    category VARCHAR(100) NOT NULL, -- 'INSECTICIDE', 'FUNGICIDE', 'HERBICIDE', 'BIO_STIMULANT', 'SEED', 'FERTILIZER'
    base_unit VARCHAR(30) NOT NULL, -- 'BOTTLE', 'PACKET', 'KG', 'LITER'
    carton_multiplier NUMERIC(10, 3) DEFAULT 1.0, -- e.g. 1 Carton = 20 Bottles
    default_barcode VARCHAR(100),
    standard_retail_price NUMERIC(12, 2) NOT NULL,
    standard_wholesale_price NUMERIC(12, 2) NOT NULL,
    min_stock_alert INT DEFAULT 5,
    image_path VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Inventory Lots (Shipments with Entry Date, Expiry & Dynamic Cost)
CREATE TABLE inventory_lot (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    lot_number VARCHAR(50) NOT NULL,
    entry_date DATE NOT NULL, -- Exact date lot entered Godown
    expiry_date DATE NOT NULL,
    purchase_cost NUMERIC(12, 2) NOT NULL, -- Exact cost for this lot
    lot_retail_price NUMERIC(12, 2) NOT NULL,
    lot_wholesale_price NUMERIC(12, 2) NOT NULL,
    barcode VARCHAR(100) NOT NULL UNIQUE,
    supplier_name VARCHAR(150),
    challan_no VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Stock Inventory by Location per Lot
CREATE TABLE stock_inventory (
    id BIGSERIAL PRIMARY KEY,
    lot_id BIGINT NOT NULL REFERENCES inventory_lot(id) ON DELETE CASCADE,
    location VARCHAR(20) NOT NULL, -- 'DOKAN' or 'GODOWN'
    quantity NUMERIC(12, 3) NOT NULL DEFAULT 0, -- Stored in base units (bottles/packets)
    CONSTRAINT uq_lot_location UNIQUE (lot_id, location)
);

-- 4. Godown Movement Audit Log (Date-wise Entry & Exit)
CREATE TABLE godown_movement (
    id BIGSERIAL PRIMARY KEY,
    lot_id BIGINT NOT NULL REFERENCES inventory_lot(id),
    movement_type VARCHAR(50) NOT NULL, -- 'PURCHASE_ENTRY', 'TRANSFER_TO_DOKAN', 'DIRECT_WHOLESALE_DISPATCH', 'DAMAGE_EXIT', 'RETURN_ENTRY'
    quantity NUMERIC(12, 3) NOT NULL,
    movement_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reference_no VARCHAR(100),
    remarks TEXT
);

-- 5. Customer Profile (Wholesale Dealers & Retail Accounts)
CREATE TABLE customer (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL, -- Proprietor Name
    father_name VARCHAR(150), -- Disambiguation in rural unions
    business_name VARCHAR(200), -- e.g. "মেসার্স মদিনা ট্রেডার্স" (Wholesale sub-dealer store name)
    phone VARCHAR(50) NOT NULL,
    whatsapp_number VARCHAR(50), -- For sending digital bills & due reminders
    email VARCHAR(100),
    village_address VARCHAR(255),
    customer_type VARCHAR(30) NOT NULL, -- 'WHOLESALE' or 'RETAIL'
    credit_limit NUMERIC(12, 2) DEFAULT 0, -- Max due ceiling
    current_due NUMERIC(12, 2) NOT NULL DEFAULT 0,
    mfs_type VARCHAR(30), -- 'BKASH', 'NAGAD', 'ROCKET'
    mfs_number VARCHAR(50),
    bank_name VARCHAR(100), -- e.g. 'Islami Bank', 'Sonali Bank'
    bank_branch VARCHAR(100),
    bank_account_no VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Customer Due Ledger (Bakir Khata)
CREATE TABLE customer_ledger (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
    transaction_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    transaction_type VARCHAR(50) NOT NULL, -- 'INVOICE_BILL', 'CASH_PAYMENT', 'RETURN_CREDIT'
    debit NUMERIC(12, 2) DEFAULT 0,  -- Increases due
    credit NUMERIC(12, 2) DEFAULT 0, -- Decreases due
    balance_after NUMERIC(12, 2) NOT NULL,
    money_receipt_no VARCHAR(50), -- Paper deposit slip (মানি রিসিট) for payments
    sale_id BIGINT,
    notes TEXT
);

-- 7. Sales Invoices (Supports Split Payment: Cash + Digital + Due)
CREATE TABLE sale (
    id BIGSERIAL PRIMARY KEY,
    invoice_no VARCHAR(50) NOT NULL UNIQUE,
    sale_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    customer_id BIGINT REFERENCES customer(id),
    sale_mode VARCHAR(20) NOT NULL, -- 'RETAIL' or 'WHOLESALE'
    subtotal NUMERIC(12, 2) NOT NULL,
    discount NUMERIC(12, 2) DEFAULT 0,
    round_off NUMERIC(12, 2) DEFAULT 0, -- Small change adjustment
    total_amount NUMERIC(12, 2) NOT NULL,
    payment_method VARCHAR(30) NOT NULL DEFAULT 'CASH', -- 'CASH', 'BKASH', 'NAGAD', 'BANK_TRANSFER', 'DUE', 'SPLIT'
    cash_paid NUMERIC(12, 2) DEFAULT 0,
    digital_paid NUMERIC(12, 2) DEFAULT 0,
    digital_medium VARCHAR(30), -- 'BKASH', 'NAGAD', 'BANK_TRANSFER'
    digital_trx_id VARCHAR(100), -- OPTIONAL: user-friendly fast entry
    due_amount NUMERIC(12, 2) DEFAULT 0,
    cashier_name VARCHAR(100)
);

-- 8. Sale Items with Split Fulfillment & Cost Snapshot
CREATE TABLE sale_item (
    id BIGSERIAL PRIMARY KEY,
    sale_id BIGINT NOT NULL REFERENCES sale(id) ON DELETE CASCADE,
    lot_id BIGINT NOT NULL REFERENCES inventory_lot(id),
    total_quantity NUMERIC(12, 3) NOT NULL,
    dokan_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0,
    godown_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0,
    unit_price NUMERIC(12, 2) NOT NULL, -- Supports bargaining price override
    unit_cost NUMERIC(12, 2) NOT NULL, -- Frozen cost snapshot for gross profit
    subtotal NUMERIC(12, 2) NOT NULL
);

-- 9. Sales Return (Supports returns with or without original invoice)
CREATE TABLE sale_return (
    id BIGSERIAL PRIMARY KEY,
    return_no VARCHAR(50) NOT NULL UNIQUE,
    original_sale_id BIGINT REFERENCES sale(id), -- Nullable for direct returns
    customer_id BIGINT REFERENCES customer(id),
    return_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_refund_amount NUMERIC(12, 2) NOT NULL,
    refund_type VARCHAR(30) NOT NULL, -- 'CASH_REFUND' or 'DUE_ADJUSTMENT'
    reason TEXT
);

-- 10. Sale Return Items (With Damaged Goods Routing)
CREATE TABLE sale_return_item (
    id BIGSERIAL PRIMARY KEY,
    sale_return_id BIGINT NOT NULL REFERENCES sale_return(id) ON DELETE CASCADE,
    lot_id BIGINT NOT NULL REFERENCES inventory_lot(id),
    quantity NUMERIC(12, 3) NOT NULL,
    refund_price NUMERIC(12, 2) NOT NULL,
    is_damaged BOOLEAN DEFAULT FALSE, -- If true, routes to damaged disposal rather than sellable stock
    restock_location VARCHAR(20) NOT NULL -- 'DOKAN' or 'GODOWN'
);
```

---

## 5. REST API Specifications

### Products & Lots
- `GET /api/products` - List products with active lot summaries.
- `POST /api/products` - Create brand product with carton multiplier.
- `POST /api/products/{id}/lots` - Record incoming lot in Godown with `entry_date`, `purchase_cost`, and `expiry_date`.
- `GET /api/lots/barcode/{barcode}` - Scanned barcode lookup returning product, lot details, and Dokan/Godown stocks.
- `GET /api/lots/{id}/barcode-image` - Return printable PNG barcode for sticker printing.

### Stock & Godown Management
- `GET /api/stock` - Live inventory matrix across Dokan and Godown.
- `POST /api/stock/transfer` - Transfer quantity from `GODOWN` to `DOKAN` (or vice versa).
- `GET /api/godown/movements?startDate=...&endDate=...` - Date-wise movement audit log.

### Sales & Billing
- `POST /api/sales` - Submit sale with split Dokan/Godown deduction, line discounts, round-off, and due ledger update.
- `GET /api/sales/{invoiceNo}` - Retrieve invoice details for reprinting (Thermal or A4).
- `POST /api/sales/return` - Process a sales return (with or without original invoice).

### Customers & Dues
- `GET /api/customers` - List customers with balance filter.
- `GET /api/customers/{id}/ledger` - View chronological purchase and payment history.
- `POST /api/customers/{id}/payments` - Record a cash payment against outstanding dues.

### Analytics & Backup
- `GET /api/dashboard/summary?startDate=...&endDate=...` - Returns total sales, gross profit, cash in drawer, total dues, and expiring-soon count.
- `GET /api/backup/export` - Triggers an immediate 1-click database backup download.

---

## 6. Implementation Verification Plan

1. **Backend Integration Tests:**
   - Verify lot creation with entry date and fluctuating purchase cost.
   - Verify gross profit calculation when product cost fluctuates.
   - Verify atomic split-fulfillment (deducting from Dokan and Godown in one transaction).
   - Verify negative stock sales when enabled.
   - Verify customer ledger updates (debit on credit sale, credit on cash receipt).
   - Verify direct sales return without invoice.
2. **Frontend UI Tests:**
   - Verify fast barcode scanning and cart line item price override.
   - Test FEFO lot auto-selection and manual lot picker dropdown.
   - Test split-stock prompt when cashier enters quantity > Dokan stock.
   - Test Thermal 80mm preview and print layout.
   - Test A4 Wholesale Order Invoice print preview.
   - Test 1-click Database Backup button.
