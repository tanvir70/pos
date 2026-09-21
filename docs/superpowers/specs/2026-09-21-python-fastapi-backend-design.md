# POS & Inventory System — Python (FastAPI + MySQL) Backend Migration Design Specification

**Document Reference**: `SPEC-20260921-POS-PYTHON`  
**Status**: APPROVED (Incorporating Senior Engineer Review Refinements)  
**Author**: Principal Software Architect & Senior Engineering Review Team  
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

## 2. Technology Stack & Wire Serialization Contract

| Layer | Selected Technology | Version / Specification | Rationale |
| :--- | :--- | :--- | :--- |
| **Language Runtime** | Python | `>= 3.11` | Modern async syntax, performance enhancements, native `zoneinfo`. |
| **Web Framework** | **FastAPI** | `>= 0.115` | High-throughput ASGI framework, native OpenAPI/Swagger at `/docs`. |
| **Data Validation** | **Pydantic v2** | `>= 2.9` | Rust-backed fast serialization, type safety matching TypeScript models. |
| **ORM / Database Layer**| **SQLAlchemy** | `2.0+` | Type-annotated Mapped models, connection pooling, unit-of-work. |
| **Database Driver** | **`aiomysql` / `asyncmy` / `pymysql`** | Latest stable | Pure Python MySQL driver support with SSL and `caching_sha2_password`. |
| **Database Engine** | **MySQL / MariaDB** | `8.0+ / 10.5+` | Standard cPanel database; InnoDB engine with ACID transactions. |
| **Schema Migrations** | **Alembic** | `>= 1.13` | Replaces Flyway for versioned, reproducible database migrations. |
| **Authentication** | **PyJWT + Passlib (`bcrypt`)**| Latest stable | Exact match for Spring Security JWT Bearer token authentication (HMAC-SHA256). |
| **Barcode Service** | **`python-barcode` + `Pillow`**| Latest stable | Server-side Code128 PNG sticker generation (`/api/barcode/*`). |
| **Deployment Gateway**| **Uvicorn + `a2wsgi`** | Latest stable | Uvicorn for local dev/testing; `a2wsgi` adapter for cPanel Passenger WSGI. |

### 2.1 JSON Wire Contract (`camelCase` Enforcement)
The React frontend strictly expects `camelCase` keys (`productCode`, `totalAmount`, `currentDue`, `moneyReceiptNo`). All Pydantic request/response schemas inherit from `CamelModel`:
```python
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )
```

### 2.2 Uniform Error Contract (`ErrorResponse`)
To ensure frontend toast notifications and error dialogs display clear messages instead of raw validation arrays, FastAPI global exception handlers format all errors to:
```python
class ErrorResponse(CamelModel):
    timestamp: str
    status: int
    error_code: str
    message: str
    path: str
    details: dict[str, str] | None = None
```

---

## 3. Database Schema Specification (MySQL 8.0 InnoDB)

All monetary columns use `DECIMAL(12, 2)`. All stock, carton multiplier, and order quantity columns use `DECIMAL(12, 3)` to preserve fractional unit precision (e.g., kilograms, liters). All tables use `InnoDB` with UTF-8 (`utf8mb4`).

### 3.1 Document Sequences Table (`document_sequences`)
Atomic sequence generator replacing PostgreSQL sequences:
```sql
CREATE TABLE document_sequences (
    sequence_name VARCHAR(64) PRIMARY KEY,
    current_val BIGINT NOT NULL DEFAULT 0,
    prefix VARCHAR(16) NOT NULL,
    max_val BIGINT NOT NULL DEFAULT 999999,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO document_sequences (sequence_name, current_val, prefix, max_val) VALUES
('sale_invoice', 0, 'INV', 999999),
('due_invoice', 0, 'DUE', 999999),
('sale_return', 0, 'RET', 999999),
('stock_adjustment', 1000, 'ADJ', 999999);
```

### 3.2 Security & Users Table (`app_user`)
```sql
CREATE TABLE app_user (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    username VARCHAR(60) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'ROLE_CASHIER', -- 'ROLE_OWNER' or 'ROLE_CASHIER'
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at DATETIME NULL
) ENGINE=InnoDB;
```

### 3.3 Master Catalog Table (`product`)
```sql
CREATE TABLE product (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    product_code VARCHAR(50) NOT NULL UNIQUE,
    name_en VARCHAR(255) NOT NULL,
    name_bn VARCHAR(255) NOT NULL,
    company_name VARCHAR(150) DEFAULT 'Agro Chem',
    category VARCHAR(100) NOT NULL,
    base_unit VARCHAR(30) NOT NULL,
    carton_multiplier DECIMAL(10, 3) NOT NULL DEFAULT 1.000,
    default_barcode VARCHAR(100) NULL,
    standard_retail_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    standard_wholesale_price DECIMAL(12, 2) NULL,
    buying_price DECIMAL(12, 2) NULL,
    min_stock_alert INT NOT NULL DEFAULT 5,
    image_path VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
```

### 3.4 Batch Inventory Lots Table (`inventory_lot`)
```sql
CREATE TABLE inventory_lot (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    product_id BIGINT NOT NULL,
    lot_number VARCHAR(50) NOT NULL,
    entry_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    purchase_cost DECIMAL(12, 2) NOT NULL,
    lot_retail_price DECIMAL(12, 2) NOT NULL,
    lot_wholesale_price DECIMAL(12, 2) NOT NULL,
    barcode VARCHAR(100) NOT NULL UNIQUE,
    supplier_name VARCHAR(150) NULL,
    challan_no VARCHAR(100) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_lot_product FOREIGN KEY (product_id) REFERENCES product(id) ON DELETE CASCADE,
    INDEX idx_lot_product (product_id),
    INDEX idx_lot_barcode (barcode),
    INDEX idx_lot_expiry (expiry_date)
) ENGINE=InnoDB;
```

### 3.5 Physical Stock Table (`stock_inventory`)
Tracks stock per lot and physical location (`DOKAN` or `QUARANTINE`):
```sql
CREATE TABLE stock_inventory (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    lot_id BIGINT NOT NULL,
    location VARCHAR(20) NOT NULL DEFAULT 'DOKAN', -- 'DOKAN' or 'QUARANTINE'
    quantity DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
    CONSTRAINT fk_stock_lot FOREIGN KEY (lot_id) REFERENCES inventory_lot(id) ON DELETE CASCADE,
    CONSTRAINT uq_lot_location UNIQUE (lot_id, location)
) ENGINE=InnoDB;
```

### 3.6 Customers Table (`customer`)
```sql
CREATE TABLE customer (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    name VARCHAR(200) NOT NULL,
    father_name VARCHAR(150) NULL,
    business_name VARCHAR(200) NULL,
    phone VARCHAR(50) NOT NULL,
    whatsapp_number VARCHAR(50) NULL,
    email VARCHAR(100) NULL,
    village_address VARCHAR(255) NULL,
    customer_type VARCHAR(30) NOT NULL DEFAULT 'RETAIL', -- 'RETAIL' or 'WHOLESALE'
    credit_limit DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    current_due DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_purchases DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    mfs_type VARCHAR(30) NULL,
    mfs_number VARCHAR(50) NULL,
    bank_name VARCHAR(100) NULL,
    bank_branch VARCHAR(100) NULL,
    bank_account_no VARCHAR(100) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_customer_phone (phone)
) ENGINE=InnoDB;
```

### 3.7 Customer Ledger Audit Trail (`customer_ledger`)
```sql
CREATE TABLE customer_ledger (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    transaction_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    transaction_type VARCHAR(50) NOT NULL, -- 'SALE_DUE', 'PAYMENT', 'RETURN_REFUND', 'OPENING_BALANCE'
    debit DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    credit DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    balance_after DECIMAL(12, 2) NOT NULL,
    money_receipt_no VARCHAR(50) NULL,
    sale_id BIGINT NULL,
    notes TEXT NULL,
    CONSTRAINT fk_ledger_customer FOREIGN KEY (customer_id) REFERENCES customer(id) ON DELETE CASCADE,
    INDEX idx_ledger_customer_date (customer_id, transaction_date DESC)
) ENGINE=InnoDB;
```

### 3.8 Sales Invoices & Items Tables (`sale`, `sale_item`)
```sql
CREATE TABLE sale (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    invoice_no VARCHAR(50) NOT NULL UNIQUE,
    sale_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    customer_id BIGINT NULL,
    sale_mode VARCHAR(20) NOT NULL DEFAULT 'RETAIL',
    subtotal DECIMAL(12, 2) NOT NULL,
    discount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    round_off DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(12, 2) NOT NULL,
    payment_method VARCHAR(30) NOT NULL DEFAULT 'CASH',
    cash_paid DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    cash_tendered DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    change_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    digital_paid DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    digital_medium VARCHAR(30) NULL,
    digital_trx_id VARCHAR(100) NULL,
    due_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    cashier_name VARCHAR(100) NULL,
    CONSTRAINT fk_sale_customer FOREIGN KEY (customer_id) REFERENCES customer(id) ON DELETE SET NULL,
    INDEX idx_sale_invoice (invoice_no),
    INDEX idx_sale_customer (customer_id, sale_date DESC),
    INDEX idx_sale_date (sale_date DESC)
) ENGINE=InnoDB;

CREATE TABLE sale_item (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sale_id BIGINT NOT NULL,
    lot_id BIGINT NOT NULL,
    total_quantity DECIMAL(12, 3) NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    unit_cost DECIMAL(12, 2) NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    CONSTRAINT fk_item_sale FOREIGN KEY (sale_id) REFERENCES sale(id) ON DELETE CASCADE,
    CONSTRAINT fk_item_lot FOREIGN KEY (lot_id) REFERENCES inventory_lot(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
```

### 3.9 Sales Returns Tables (`sale_return`, `sale_return_item`)
```sql
CREATE TABLE sale_return (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    return_no VARCHAR(50) NOT NULL UNIQUE,
    original_sale_id BIGINT NULL,
    customer_id BIGINT NULL,
    return_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_refund_amount DECIMAL(12, 2) NOT NULL,
    refund_type VARCHAR(30) NOT NULL, -- 'CASH_REFUND' or 'DUE_ADJUSTMENT'
    reason TEXT NULL,
    CONSTRAINT fk_return_sale FOREIGN KEY (original_sale_id) REFERENCES sale(id) ON DELETE SET NULL,
    CONSTRAINT fk_return_customer FOREIGN KEY (customer_id) REFERENCES customer(id) ON DELETE SET NULL,
    INDEX idx_return_date (return_date DESC)
) ENGINE=InnoDB;

CREATE TABLE sale_return_item (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sale_return_id BIGINT NOT NULL,
    lot_id BIGINT NOT NULL,
    quantity DECIMAL(12, 3) NOT NULL,
    refund_price DECIMAL(12, 2) NOT NULL,
    is_damaged BOOLEAN NOT NULL DEFAULT FALSE,
    restock_location VARCHAR(20) NOT NULL DEFAULT 'DOKAN',
    CONSTRAINT fk_ritem_return FOREIGN KEY (sale_return_id) REFERENCES sale_return(id) ON DELETE CASCADE,
    CONSTRAINT fk_ritem_lot FOREIGN KEY (lot_id) REFERENCES inventory_lot(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
```

### 3.10 Immutable Stock Ledger & Write-Off Tables (`stock_movement`, `stock_adjustment`)
```sql
CREATE TABLE stock_movement (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT NOT NULL,
    lot_id BIGINT NOT NULL,
    movement_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    movement_type VARCHAR(40) NOT NULL, -- 'LOT_INWARD', 'POS_SALE', 'CUSTOMER_RETURN', 'DAMAGE_WRITEOFF', 'ADJUSTMENT'
    location VARCHAR(20) NOT NULL DEFAULT 'DOKAN',
    quantity_change DECIMAL(12, 3) NOT NULL,
    balance_before DECIMAL(12, 3) NOT NULL,
    balance_after DECIMAL(12, 3) NOT NULL,
    unit VARCHAR(30) NOT NULL,
    reference_doc_no VARCHAR(100) NULL,
    remarks VARCHAR(255) NULL,
    performed_by VARCHAR(100) NULL,
    CONSTRAINT fk_smov_product FOREIGN KEY (product_id) REFERENCES product(id) ON DELETE CASCADE,
    CONSTRAINT fk_smov_lot FOREIGN KEY (lot_id) REFERENCES inventory_lot(id) ON DELETE CASCADE,
    INDEX idx_smov_lot (lot_id),
    INDEX idx_smov_product (product_id),
    INDEX idx_smov_time (movement_time DESC)
) ENGINE=InnoDB;

CREATE TABLE stock_adjustment (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    adjustment_no VARCHAR(50) NOT NULL UNIQUE,
    adjustment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    product_id BIGINT NOT NULL,
    lot_id BIGINT NOT NULL,
    adjustment_type VARCHAR(40) NOT NULL,
    quantity DECIMAL(12, 3) NOT NULL,
    unit VARCHAR(30) NOT NULL,
    action_type VARCHAR(30) NOT NULL,
    cost_price DECIMAL(12, 2) NOT NULL,
    total_loss_value DECIMAL(12, 2) NOT NULL,
    reason TEXT NOT NULL,
    performed_by VARCHAR(100) NULL,
    CONSTRAINT fk_sadj_product FOREIGN KEY (product_id) REFERENCES product(id) ON DELETE CASCADE,
    CONSTRAINT fk_sadj_lot FOREIGN KEY (lot_id) REFERENCES inventory_lot(id) ON DELETE CASCADE,
    INDEX idx_sadj_date (adjustment_date DESC)
) ENGINE=InnoDB;
```

### 3.11 Idempotency Table (`idempotency_record`)
Protects mutating requests against duplicate execution:
```sql
CREATE TABLE idempotency_record (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    idempotency_key VARCHAR(100) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL, -- 'IN_PROGRESS', 'COMPLETED'
    response_code INT NULL,
    response_body LONGTEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_idemp_key (idempotency_key)
) ENGINE=InnoDB;
```

---

## 4. Concurrency & Business Rules Implementation

### 4.1 Strict Concurrency-Safe Sequence Generation
```python
async def get_next_sequence(session: AsyncSession, sequence_name: str) -> str:
    # 1. Acquire exclusive pessimistic row lock in InnoDB
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
    update(StockInventory)
    .where(
        StockInventory.lot_id == lot_id,
        StockInventory.location == "DOKAN",
        StockInventory.quantity >= qty_to_deduct
    )
    .values(quantity=StockInventory.quantity - qty_to_deduct)
)
result = await session.execute(stmt)
if result.rowcount == 0:
    raise HTTPException(status_code=400, detail="Stock insufficient or changed concurrently")
```

### 4.3 O(1) Customer Lifetime Purchases
```python
if sale.customer_id:
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

## 5. Complete API Parity & Endpoint Routing Matrix

Every single route matches the frontend TypeScript client contracts in `frontend/src/api/endpoints.ts`:

| Group | Method | Exact Path | Python Handler Function | Response Type / Description |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/auth/login` | `login(request: LoginRequest)` | `AuthTokenResponse` |
| | `GET` | `/api/auth/me` | `get_current_user_profile()` | Current user profile |
| **Products**| `GET` | `/api/products` | `list_products(query: str | None)` | `list[ProductDto]` |
| | `POST` | `/api/products` | `create_product(body: ProductCreateDto)`| `ProductDto` |
| | `PUT` | `/api/products/{id}` | `update_product(id: int, body)` | `ProductDto` |
| | `DELETE`| `/api/products/{id}` | `delete_product(id: int)` | `{"message": "Deleted"}` |
| **Inventory**| `GET` | `/api/inventory/stock` | `get_stock(inStockOnly: bool)` | `list[StockItemDto]` |
| | `GET` | `/api/inventory/lots` | `get_lots(productId: int, fefo: bool)` | `list[InventoryLotDto]` |
| | `POST` | `/api/inventory/lots` | `create_lot(body: LotEntryRequest)` | `InventoryLotDto` |
| | `GET` | `/api/inventory/quarantine` | `get_quarantine_stock()` | `list[QuarantineStockItemDto]` |
| | `POST` | `/api/inventory/quarantine/dispose` | `dispose_quarantine(body)` | `{"message": str}` |
| | `GET` | `/api/inventory/movements` | `get_movements(productId, lotId, page, size)`| `PagedResponse[StockMovementDto]` |
| | `POST` | `/api/inventory/adjustments` | `create_adjustment(body)` | `StockAdjustmentResponse` |
| | `GET` | `/api/inventory/adjustments` | `get_adjustments(productId, page, size)`| `PagedResponse[StockAdjustmentResponse]` |
| | `GET` | `/api/inventory/valuation` | `get_stock_valuation()` | `StockValuationSummaryDto` |
| **Barcodes** | `GET` | `/api/barcode/{barcode}` | `get_barcode_image(barcode, width, height)`| `image/png` with 24h cache |
| | `GET` | `/api/lots/{lotId}/barcode-image` | `get_lot_barcode_image(lotId, width, height)`| `image/png` with 24h cache |
| **Sales** | `POST` | `/api/sales` | `create_sale(body: SaleRequest)` | `SaleResponse` (INV- sequence) |
| | `GET` | `/api/sales/{id}` | `get_sale_by_id(id: int)` | `SaleResponse` |
| | `GET` | `/api/sales/invoice/{invoiceNo}` | `get_sale_by_invoice(invoiceNo: str)` | `SaleResponse` |
| | `GET` | `/api/sales` | `get_sales(limit, page, size, period, saleMode)`| `list[SaleResponse] \| PagedResponse` |
| **Customers**| `GET` | `/api/customers` | `list_customers(query, type)` | `list[CustomerDto]` |
| | `POST` | `/api/customers` | `create_customer(body: CustomerRequest)`| `CustomerDto` |
| | `GET` | `/api/customers/{id}` | `get_customer_by_id(id: int)` | `CustomerDto` |
| | `PUT` | `/api/customers/{id}` | `update_customer(id: int, body)` | `CustomerDto` |
| | `GET` | `/api/customers/{id}/ledger` | `get_customer_ledger(id: int)` | `list[CustomerLedgerDto]` |
| | `POST` | `/api/customers/{id}/payments` | `record_payment(id: int, body)` | `CustomerLedgerDto` |
| | `GET` | `/api/customers/{id}/purchases` | `get_customer_purchases(id: int)` | `list[SaleResponse]` |
| | `GET` | `/api/customers/next-due-invoice-no`| `get_next_due_invoice_no()` | `{"dueInvoiceNo": "DUE-..."}` |
| **Returns** | `POST` | `/api/returns` | `create_return(body: SaleReturnRequest)`| `SaleReturnResponse` |
| | `GET` | `/api/returns/{id}` | `get_return_by_id(id: int)` | `SaleReturnResponse` |
| | `GET` | `/api/returns` | `get_recent_returns(limit: int)` | `list[SaleReturnResponse]` |
| **Dashboard**| `GET` | `/api/dashboard/summary` | `get_dashboard_summary()` | `DashboardSummaryDto` |
| | `GET` | `/api/dashboard/top-selling` | `get_top_selling(period, page, size)` | `PagedResponse[TopSellingProduct]` |
| **Backup** | `GET` | `/api/backup/download` | `download_backup()` | `application/sql` streaming dump |

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
│   ├── main.py                  # FastAPI app, CORS, exception handlers, middleware
│   ├── config.py                # Pydantic Settings (.env configuration)
│   ├── database.py              # Engine, sessionmaker, get_db dependency
│   ├── models/                  # SQLAlchemy 2.0 mapped models
│   │   ├── base.py              # DeclarativeBase with timestamp mixin
│   │   ├── sequence.py          # DocumentSequence
│   │   ├── user.py              # AppUser
│   │   ├── product.py           # Product
│   │   ├── inventory.py         # InventoryLot, StockInventory, StockMovement, StockAdjustment
│   │   ├── customer.py          # Customer, CustomerLedger
│   │   ├── sale.py              # Sale, SaleItem
│   │   ├── sale_return.py       # SaleReturn, SaleReturnItem
│   │   └── idempotency.py       # IdempotencyRecord
│   ├── schemas/                 # CamelModel Pydantic v2 DTOs
│   │   ├── base.py              # CamelModel, PagedResponse, ErrorResponse
│   │   ├── auth.py
│   │   ├── product.py
│   │   ├── inventory.py
│   │   ├── customer.py
│   │   ├── sale.py
│   │   ├── sale_return.py
│   │   └── dashboard.py
│   ├── services/                # Business logic and atomic transactions
│   │   ├── sequence_service.py
│   │   ├── auth_service.py
│   │   ├── barcode_service.py
│   │   ├── inventory_service.py
│   │   ├── sale_service.py
│   │   ├── customer_service.py
│   │   ├── return_service.py
│   │   ├── dashboard_service.py
│   │   └── backup_service.py
│   └── routers/                 # REST API Routers
│       ├── auth.py
│       ├── products.py
│       ├── inventory.py
│       ├── barcodes.py
│       ├── sales.py
│       ├── customers.py
│       ├── returns.py
│       ├── dashboard.py
│       └── backup.py
├── tests/                       # Pytest test suite
│   ├── conftest.py
│   ├── test_sequences.py
│   ├── test_auth.py
│   ├── test_products.py
│   ├── test_inventory.py
│   ├── test_sales.py
│   ├── test_customers.py
│   ├── test_returns.py
│   └── test_dashboard.py
├── passenger_wsgi.py            # Production entry point for cPanel Phusion Passenger
├── requirements.txt             # Pinned production dependencies
└── run.py                       # Local Uvicorn runner
```

---

## 7. cPanel Deployment & Server Gateway Configuration

### 7.1 WSGI / ASGI Bridge (`passenger_wsgi.py`)
Because cPanel runs Phusion Passenger (WSGI), we bridge FastAPI (ASGI) cleanly using `a2wsgi`:
```python
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from a2wsgi import ASGIMiddleware
from app.main import app

application = ASGIMiddleware(app)
```

### 7.2 Connection Pool Configuration (Tuned for CloudLinux 25 Entry Processes)
In `app/database.py`:
```python
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_size=2,          # Max 2 persistent connections per worker process
    max_overflow=3,       # Temporary burst allowance of 3
    pool_recycle=280,     # Safely under MySQL 300s wait_timeout
    pool_pre_ping=True,   # Handle dropped/killed connections
)
```

---

## 8. Verification & Cutover Plan

1. **Phase 1: Unit & Integration Tests (`pytest`)**
   - 100% test coverage across all 30+ endpoints.
   - Concurrency tests verifying zero duplicate sequence numbers generated.
   - Atomic inventory lot deduction verification.
2. **Phase 2: Database Seed & Migration Verification**
   - Alembic migration creates all 11 InnoDB tables with indexes.
   - Default owner user (`owner` / `owner123`) seeded.
   - Initial `document_sequences` seeded.
3. **Phase 3: Frontend Integration Verification**
   - Switch Vite frontend API proxy to Python backend on port 8000.
   - Run end-to-end browser checkout, customer due collection, barcode generation, thermal receipt preview.
   - Zero frontend code changes confirmed.
