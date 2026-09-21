# POS & Inventory System — Python (FastAPI + MySQL) Backend Migration Design Specification

**Document Reference**: `SPEC-20260921-POS-PYTHON`  
**Status**: PROPOSED  
**Author**: Principal Software Architect & Engineering Team  
**Date**: September 21, 2026  
**Target Environment**: Hostever Singapore Advance Linux Hosting (cPanel / Phusion Passenger / MySQL 8.0)  

---

## 1. Executive Summary & Migration Objectives

### 1.1 Problem Statement
The current POS & Inventory prototype operates on a Java 21 / Spring Boot 3.4 / PostgreSQL stack. While robust, the runtime memory footprint (450 MB – 700 MB base idle RAM) and process model make it incompatible with shared cPanel hosting environments (such as Hostever Singapore Advance 2GB, which provides 1.5 GB RAM, a 1-core CPU limit, and CloudLinux LVE constraints). Furthermore, standard shared hosting environments only offer MySQL/MariaDB and do not support native PostgreSQL sequences or persistent Java daemons.

### 1.2 Core Objectives
1. **Drastic Resource Optimization**: Re-architect the backend in **Python 3.11+ / FastAPI** to achieve:
   - **Idle RAM**: ~50 MB – 75 MB (an **85% reduction** in memory consumption).
   - **Disk Footprint**: ~75 MB `venv` (saving 75% of disk on a 2 GB NVMe SSD limit).
   - **Cold Start**: < 1.0 second (eliminating CloudLinux CPU throttle spikes).
2. **Zero Frontend Rewrites**: Preserve 100% of existing REST API contracts, path hierarchies (`/api/*`), query parameters, and JSON payloads so the React + Vite frontend requires zero code modifications.
3. **Zero Risk / Parallel Backend**: Develop the new backend entirely within `backend-python/` alongside the existing Java `backend/`. The Java backend remains operational until the Python test suite proves 100% equivalence.
4. **Financial & Concurrency Hardening**: Transition from PostgreSQL to MySQL while eliminating race conditions, floating-point rounding errors, and sequence collision risks.

---

## 2. Technology Stack & Architecture

| Layer | Selected Technology | Version / Specification | Rationale |
| :--- | :--- | :--- | :--- |
| **Language Runtime** | Python | `>= 3.11` | Modern async syntax, performance enhancements, native `zoneinfo`. |
| **Web Framework** | **FastAPI** | `>= 0.115` | High-throughput ASGI framework, native OpenAPI/Swagger at `/docs`. |
| **Data Validation** | **Pydantic v2** | `>= 2.9` | Rust-backed fast serialization, type safety matching TypeScript models. |
| **ORM / Database Layer**| **SQLAlchemy (Async)** | `2.0+` | Type-annotated Mapped models, async connection pooling, unit-of-work. |
| **Database Driver** | **`asyncmy` / `aiomysql`** | Latest stable | Pure async MySQL/MariaDB protocol driver. |
| **Database Engine** | **MySQL / MariaDB** | `8.0+ / 10.5+` | Standard cPanel database; InnoDB engine with ACID transactions. |
| **Schema Migrations** | **Alembic** | `>= 1.13` | Replaces Flyway for versioned, reproducible database migrations. |
| **Authentication** | **PyJWT + Passlib (`bcrypt`)**| Latest stable | Exact match for Spring Security JWT Bearer token authentication. |
| **Barcode Service** | **`python-barcode` + `Pillow`**| Latest stable | Server-side Code128 and EAN-13 SVG/PNG sticker generation. |
| **Deployment Gateway**| **Uvicorn + `a2wsgi`** | Latest stable | Uvicorn for local/VPS development; `a2wsgi` adapter for cPanel Passenger. |

---

## 3. Database Schema & Models Specification

All financial columns use `DECIMAL(12, 2)` to eliminate floating-point drift. All primary keys use `BIGINT AUTO_INCREMENT`.

### 3.1 Document Sequences Table (`document_sequences`)
Provides an atomic, gapless sequence generator replacing PostgreSQL sequences:
```sql
CREATE TABLE document_sequences (
    sequence_name VARCHAR(64) PRIMARY KEY,
    current_val BIGINT NOT NULL DEFAULT 0,
    prefix VARCHAR(16) NOT NULL,
    max_val BIGINT NOT NULL DEFAULT 999999,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
```
Initial seed records:
- `('sale_invoice', 0, 'INV', 999999)`
- `('due_invoice', 0, 'DUE', 999999)`
- `('sale_return', 0, 'RET', 999999)`
- `('stock_adjustment', 0, 'ADJ', 999999)`

### 3.2 User & Security Table (`users`)
```sql
CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'CASHIER', -- 'OWNER' or 'CASHIER'
    pin VARCHAR(10) NULL,                        -- 4-digit quick approval PIN
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
) ENGINE=InnoDB;
```

### 3.3 Master Catalog Table (`products`)
```sql
CREATE TABLE products (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    bangla_name VARCHAR(150) NULL,
    sku VARCHAR(64) NOT NULL UNIQUE,
    barcode VARCHAR(64) NOT NULL UNIQUE,
    category VARCHAR(64) NOT NULL,
    manufacturer VARCHAR(100) NOT NULL,
    pack_size VARCHAR(50) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    purchase_rate DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    retail_rate DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    wholesale_rate DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    min_stock_alert INT NOT NULL DEFAULT 5,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
) ENGINE=InnoDB;
```

### 3.4 Batch Inventory Lots Table (`inventory_lots`)
```sql
CREATE TABLE inventory_lots (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT NOT NULL,
    lot_number VARCHAR(64) NOT NULL,
    supplier_name VARCHAR(100) NOT NULL,
    purchase_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    purchase_rate DECIMAL(12, 2) NOT NULL,
    retail_rate DECIMAL(12, 2) NOT NULL,
    wholesale_rate DECIMAL(12, 2) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    CONSTRAINT fk_lot_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    INDEX idx_lot_product_active (product_id, active),
    INDEX idx_lot_fifo (product_id, purchase_date, id)
) ENGINE=InnoDB;
```

### 3.5 Aggregated Dokan Stock Table (`stock_inventory`)
```sql
CREATE TABLE stock_inventory (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT NOT NULL UNIQUE,
    dokan_stock INT NOT NULL DEFAULT 0,
    godown_stock INT NOT NULL DEFAULT 0,
    min_alert INT NOT NULL DEFAULT 5,
    updated_at DATETIME NOT NULL,
    CONSTRAINT fk_stock_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

### 3.6 Customers Table (`customers`)
```sql
CREATE TABLE customers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    bangla_name VARCHAR(100) NULL,
    father_name VARCHAR(100) NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    whatsapp_number VARCHAR(20) NULL,
    village_address VARCHAR(200) NULL,
    customer_type VARCHAR(30) NOT NULL DEFAULT 'RETAIL_FARMER', -- 'WHOLESALE_CUSTOMER' or 'RETAIL_FARMER'
    business_name VARCHAR(150) NULL,
    total_purchases DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    current_due DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    mfs_type VARCHAR(20) NULL,
    mfs_number VARCHAR(20) NULL,
    bank_name VARCHAR(100) NULL,
    bank_branch VARCHAR(100) NULL,
    bank_account_no VARCHAR(50) NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
) ENGINE=InnoDB;
```

### 3.7 Customer Ledger Audit Trail (`customer_ledger_entries`)
```sql
CREATE TABLE customer_ledger_entries (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    transaction_date DATETIME NOT NULL,
    transaction_type VARCHAR(30) NOT NULL, -- 'INVOICE_BILL', 'CASH_PAYMENT', 'RETURN_CREDIT', 'OPENING_BALANCE'
    sale_id BIGINT NULL,
    debit DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    credit DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    balance_after DECIMAL(12, 2) NOT NULL,
    money_receipt_no VARCHAR(64) NULL,
    notes VARCHAR(255) NULL,
    created_at DATETIME NOT NULL,
    CONSTRAINT fk_ledger_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    INDEX idx_ledger_customer_date (customer_id, transaction_date DESC)
) ENGINE=InnoDB;
```

### 3.8 Sales Invoices & Items Tables (`sales`, `sale_items`)
```sql
CREATE TABLE sales (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    invoice_no VARCHAR(64) NOT NULL UNIQUE,
    sale_date DATETIME NOT NULL,
    customer_id BIGINT NULL,
    sale_mode VARCHAR(20) NOT NULL DEFAULT 'RETAIL', -- 'RETAIL' or 'WHOLESALE'
    subtotal DECIMAL(12, 2) NOT NULL,
    discount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    round_off DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(12, 2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL,            -- 'CASH', 'BKASH', 'NAGAD', 'BANK_TRANSFER', 'DUE'
    cash_tendered DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    cash_paid DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    change_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    digital_paid DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    digital_medium VARCHAR(30) NULL,
    digital_trx_id VARCHAR(64) NULL,
    due_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    cashier_name VARCHAR(100) NOT NULL,
    created_at DATETIME NOT NULL,
    CONSTRAINT fk_sale_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    INDEX idx_sale_customer_date (customer_id, sale_date DESC)
) ENGINE=InnoDB;

CREATE TABLE sale_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sale_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    lot_id BIGINT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    line_total DECIMAL(12, 2) NOT NULL,
    CONSTRAINT fk_item_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    CONSTRAINT fk_item_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    CONSTRAINT fk_item_lot FOREIGN KEY (lot_id) REFERENCES inventory_lots(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
```

### 3.9 Sales Returns Tables (`sale_returns`, `sale_return_items`)
```sql
CREATE TABLE sale_returns (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    return_no VARCHAR(64) NOT NULL UNIQUE,
    return_date DATETIME NOT NULL,
    sale_id BIGINT NULL,
    customer_id BIGINT NULL,
    refund_type VARCHAR(20) NOT NULL, -- 'CASH' or 'DUE_ADJUSTMENT'
    total_refund_amount DECIMAL(12, 2) NOT NULL,
    notes VARCHAR(255) NULL,
    cashier_name VARCHAR(100) NOT NULL,
    created_at DATETIME NOT NULL,
    CONSTRAINT fk_return_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL,
    CONSTRAINT fk_return_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE sale_return_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    return_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    lot_id BIGINT NOT NULL,
    return_quantity INT NOT NULL,
    refund_rate DECIMAL(12, 2) NOT NULL,
    line_refund_amount DECIMAL(12, 2) NOT NULL,
    condition_status VARCHAR(30) NOT NULL DEFAULT 'DAMAGED_QUARANTINE',
    CONSTRAINT fk_ritem_return FOREIGN KEY (return_id) REFERENCES sale_returns(id) ON DELETE CASCADE,
    CONSTRAINT fk_ritem_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    CONSTRAINT fk_ritem_lot FOREIGN KEY (lot_id) REFERENCES inventory_lots(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
```

### 3.10 Immutable Stock Ledger & Write-Off Tables (`stock_movements`, `stock_adjustments`)
```sql
CREATE TABLE stock_movements (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    movement_date DATETIME NOT NULL,
    movement_type VARCHAR(32) NOT NULL, -- 'LOT_INWARD', 'POS_SALE', 'CUSTOMER_RETURN', 'DAMAGE_WRITEOFF', 'ADJUSTMENT_VARIANCE'
    product_id BIGINT NOT NULL,
    lot_id BIGINT NULL,
    quantity_change INT NOT NULL,        -- Positive for additions, negative for deductions
    balance_after INT NOT NULL,
    reference_type VARCHAR(32) NOT NULL, -- 'INVOICE', 'RETURN', 'LOT_ENTRY', 'ADJUSTMENT'
    reference_id BIGINT NULL,
    reference_no VARCHAR(64) NULL,
    notes VARCHAR(255) NULL,
    operator_name VARCHAR(100) NOT NULL,
    created_at DATETIME NOT NULL,
    CONSTRAINT fk_mov_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    INDEX idx_mov_product_date (product_id, movement_date DESC)
) ENGINE=InnoDB;

CREATE TABLE stock_adjustments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    adjustment_no VARCHAR(64) NOT NULL UNIQUE,
    adjustment_date DATETIME NOT NULL,
    adjustment_type VARCHAR(32) NOT NULL, -- 'DAMAGE_BREAKAGE', 'LEAKAGE_SPILLAGE', 'EXPIRED_SCRAP', 'AUDIT_DISCREPANCY'
    product_id BIGINT NOT NULL,
    lot_id BIGINT NOT NULL,
    quantity INT NOT NULL,
    unit_cost DECIMAL(12, 2) NOT NULL,
    total_loss_value DECIMAL(12, 2) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    operator_name VARCHAR(100) NOT NULL,
    created_at DATETIME NOT NULL,
    CONSTRAINT fk_adj_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    CONSTRAINT fk_adj_lot FOREIGN KEY (lot_id) REFERENCES inventory_lots(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
```

---

## 4. Concurrency & Business Rules Implementation

### 4.1 Strict Concurrency-Safe Sequence Generation
To prevent sequence race conditions and deadlocks:
```python
async def get_next_sequence(session: AsyncSession, sequence_name: str) -> str:
    # 1. Acquire exclusive pessimistic row lock
    stmt = (
        select(DocumentSequence)
        .where(DocumentSequence.sequence_name == sequence_name)
        .with_for_update()
    )
    res = await session.execute(stmt)
    seq = res.scalar_one_or_none()
    if not seq:
        raise ValueError(f"Sequence {sequence_name} not found")

    # 2. Increment with 999999 rollover
    if seq.current_val >= seq.max_val:
        seq.current_val = 1
    else:
        seq.current_val += 1

    # 3. Format with Bangladesh date: PREFIX-YYYYMMDD-XXXXXX
    today_bd = datetime.now(ZoneInfo("Asia/Dhaka")).strftime("%Y%m%d")
    return f"{seq.prefix}-{today_bd}-{seq.current_val:06d}"
```

### 4.2 Zero-Overselling Atomic Lot Decrement
```python
# Atomic conditional deduction at DB engine level
stmt = (
    update(InventoryLot)
    .where(InventoryLot.id == lot_id, InventoryLot.quantity >= qty_to_deduct)
    .values(quantity=InventoryLot.quantity - qty_to_deduct)
)
result = await session.execute(stmt)
if result.rowcount == 0:
    raise HTTPException(status_code=400, detail="Stock insufficient or changed concurrently")
```

### 4.3 O(1) Customer Lifetime Purchases
On checkout in `sale_service.py`:
```python
if sale.customer_id:
    # Atomic increment on customer total_purchases
    await session.execute(
        update(Customer)
        .where(Customer.id == sale.customer_id)
        .values(
            total_purchases=Customer.total_purchases + sale.total_amount,
            current_due=Customer.current_due + sale.due_amount
        )
    )
```

---

## 5. API Parity & Endpoint Routing Matrix

All endpoints match the existing Spring Boot contracts:

| Group | Method | Endpoint Path | Python Handler Function | Spring Boot Equivalent |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/auth/login` | `login(request: LoginRequest)` | `AuthController.login` |
| | `GET` | `/api/auth/me` | `get_current_user_profile()` | `AuthController.getCurrentUser` |
| **Products**| `GET` | `/api/products` | `list_products(query, page, size)`| `ProductController.getAllProducts` |
| | `POST` | `/api/products` | `create_product(body: ProductDto)`| `ProductController.createProduct` |
| | `PUT` | `/api/products/{id}` | `update_product(id, body)` | `ProductController.updateProduct` |
| | `DELETE`| `/api/products/{id}` | `delete_product(id)` | `ProductController.deleteProduct` |
| **Inventory**| `POST` | `/api/inventory/lots` | `receive_lot(body: LotRequest)` | `InventoryController.receiveLot` |
| | `GET` | `/api/inventory/stock`| `get_dokan_stock()` | `InventoryController.getDokanStock` |
| | `GET` | `/api/inventory/ledger`| `get_stock_ledger(...)` | `InventoryController.getStockLedger` |
| | `POST` | `/api/inventory/adjustments`| `create_adjustment(body)` | `InventoryController.createStockAdjustment` |
| | `GET` | `/api/inventory/valuation`| `get_stock_valuation()` | `InventoryController.getStockValuationSummary` |
| **Sales** | `POST` | `/api/sales` | `process_sale(body: SaleRequest)`| `SaleController.processSale` |
| | `GET` | `/api/sales/{id}` | `get_sale_by_id(id)` | `SaleController.getSaleById` |
| | `GET` | `/api/sales` | `get_recent_sales(limit)` | `SaleController.getRecentSales` |
| **Customers**| `GET` | `/api/customers` | `list_customers(query)` | `CustomerController.getAllCustomers` |
| | `POST` | `/api/customers` | `create_customer(body)` | `CustomerController.createCustomer` |
| | `POST` | `/api/customers/{id}/repay`| `collect_due_repayment(id, body)` | `CustomerController.recordPayment` |
| | `GET` | `/api/customers/{id}/purchases`| `get_customer_purchases(id)`| `CustomerController.getCustomerPurchases` |
| | `GET` | `/api/customers/{id}/ledger` | `get_customer_ledger(id)` | `CustomerController.getCustomerLedger` |
| | `GET` | `/api/customers/next-due-invoice-no`| `get_next_due_invoice_no()`| `CustomerController.getNextDueInvoiceNo` |
| **Returns** | `POST` | `/api/returns` | `process_return(body)` | `SaleReturnController.processReturn` |
| | `GET` | `/api/returns` | `list_returns()` | `SaleReturnController.getAllReturns` |
| **Dashboard**| `GET` | `/api/dashboard/summary`| `get_dashboard_summary()` | `DashboardController.getSummary` |
| | `GET` | `/api/dashboard/top-selling`| `get_top_selling_products(...)`| `DashboardController.getTopSelling` |

---

## 6. Directory Layout & Module Structure

The Python service will be placed in `backend-python/`:

```
backend-python/
├── alembic/                     # Database migrations
│   ├── env.py
│   └── versions/
├── app/
│   ├── __init__.py
│   ├── main.py                  # FastAPI instantiation, CORS, routers
│   ├── config.py                # Pydantic Settings (.env configuration)
│   ├── database.py              # Async engine, sessionmaker, get_db dependency
│   ├── models/                  # SQLAlchemy 2.0 mapped models
│   │   ├── base.py              # DeclarativeBase with timestamp mixin
│   │   ├── user.py
│   │   ├── product.py
│   │   ├── inventory.py         # InventoryLot, StockInventory, StockMovement, StockAdjustment
│   │   ├── customer.py          # Customer, CustomerLedgerEntry
│   │   ├── sale.py              # Sale, SaleItem
│   │   ├── sale_return.py       # SaleReturn, SaleReturnItem
│   │   └── document_sequence.py
│   ├── schemas/                 # Pydantic v2 DTOs (Request / Response validation)
│   │   ├── auth.py
│   │   ├── product.py
│   │   ├── inventory.py
│   │   ├── customer.py
│   │   ├── sale.py
│   │   └── dashboard.py
│   ├── services/                # Business logic and atomic transactions
│   │   ├── sequence_service.py
│   │   ├── auth_service.py
│   │   ├── inventory_service.py
│   │   ├── sale_service.py
│   │   ├── customer_service.py
│   │   └── dashboard_service.py
│   └── routers/                 # REST API Routers
│       ├── auth.py
│       ├── products.py
│       ├── inventory.py
│       ├── sales.py
│       ├── customers.py
│       ├── returns.py
│       └── dashboard.py
├── tests/                       # Pytest test suite
│   ├── conftest.py
│   ├── test_auth.py
│   ├── test_inventory.py
│   ├── test_sales.py
│   └── test_customers.py
├── passenger_wsgi.py            # Production entry point for cPanel Phusion Passenger
├── requirements.txt             # Pinned production dependencies
└── run.py                       # Local Uvicorn runner
```

---

## 7. cPanel Deployment & Server Gateway Configuration

### 7.1 WSGI / ASGI Bridge (`passenger_wsgi.py`)
Because cPanel's "Setup Python App" runs Phusion Passenger (WSGI), we bridge FastAPI (ASGI) cleanly using `a2wsgi`:
```python
import sys
import os

# Insert application path
sys.path.insert(0, os.path.dirname(__file__))

from a2wsgi import ASGIMiddleware
from app.main import app

# Passenger entry point
application = ASGIMiddleware(app)
```

### 7.2 Database Connection Pool (Tailored for CloudLinux 25 EP)
In `app/database.py`:
```python
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_size=5,          # Lean pool per worker
    max_overflow=10,      # Temporary burst headroom
    pool_recycle=280,     # Recycle before MySQL 300s wait_timeout
    pool_pre_ping=True,   # Verify connection liveness before executing
)
```

---

## 8. Verification & Cutover Plan

1. **Phase 1: Unit & Integration Tests (`pytest`)**
   - Verify all 28 endpoints with automated tests.
   - Run concurrency tests asserting zero duplicate numbers generated from `get_next_sequence`.
2. **Phase 2: Data Seed & Migration Verification**
   - Seed default store owner (`owner` / `owner123`), initial product catalog, and test inventory lots.
   - Verify `total_purchases` increments accurately on checkout.
3. **Phase 3: Frontend Integration Verification**
   - Point the React Vite dev proxy or production API base URL to the FastAPI port (e.g. `http://localhost:8000`).
   - Run end-to-end browser tests verifying:
     - Login & Dashboard summary loading.
     - Product barcode search & POS checkout.
     - Customer Ledger & `DUE-YYYYMMDD-XXXXXX` generation.
     - Stock ledger entry audit logging.
