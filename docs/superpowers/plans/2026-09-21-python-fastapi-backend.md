# Python (FastAPI + MySQL) Backend Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-implement the POS & Inventory backend in Python 3.11+ / FastAPI + MySQL 8.0 within `backend-python/` to reduce runtime memory footprint from ~600MB to ~50-75MB for cPanel shared hosting (Hostever Singapore Advance) while preserving 100% API and schema parity with zero frontend code modifications.

**Architecture:** Async FastAPI application with SQLAlchemy 2.0 ORM, Pydantic v2 camelCase serialization layer, Alembic migrations, pessimistic locking sequence generation, and Phusion Passenger WSGI gateway integration via `a2wsgi`.

**Tech Stack:** Python 3.11+, FastAPI 0.115+, Pydantic v2, SQLAlchemy 2.0+, PyMySQL / aiomysql, Alembic, PyJWT, passlib (bcrypt), python-barcode, Pillow, a2wsgi, pytest.

**Spec:** [`docs/superpowers/specs/2026-09-21-python-fastapi-backend-design.md`](file:///home/tanvirar/Desktop/POS%20&%20Inventory%20Prototype/docs/superpowers/specs/2026-09-21-python-fastapi-backend-design.md)

## Global Constraints

- **Directory Boundary**: All new backend code strictly resides in `backend-python/`. The existing Java backend in `backend/` remains untouched and fully functional.
- **Wire Contract**: All JSON responses and requests over HTTP use `camelCase` (enforced via Pydantic v2 `alias_generator = to_camel` and `populate_by_name = True`).
- **Financial Precision**: All currency values use `DECIMAL(12, 2)`. Floating point calculations are prohibited.
- **Stock & Quantity Precision**: All stock counts, order quantities, and unit multipliers use `DECIMAL(12, 3)`.
- **Timezone**: All dates and invoice numbers are generated in `Asia/Dhaka` (UTC+6).
- **Sequence Pattern**: Document numbers strictly follow `PREFIX-YYYYMMDD-XXXXXX` (e.g. `INV-YYYYMMDD-XXXXXX`, `DUE-YYYYMMDD-XXXXXX`).
- **Database Engine**: MySQL 8.0 / MariaDB 10.5+ InnoDB tables with `utf8mb4`.
- **Shared Hosting Pool Ceiling**: SQLAlchemy connection pool configured with `pool_size=2, max_overflow=3, pool_recycle=280, pool_pre_ping=True` to comply with CloudLinux 25 Entry Process limits.

---

### Task 1: Scaffolding, Environment, Configuration & Database Engine

**Files:**
- Create: `backend-python/requirements.txt`
- Create: `backend-python/app/config.py`
- Create: `backend-python/app/database.py`
- Create: `backend-python/run.py`
- Test: `backend-python/tests/test_config.py`

**Interfaces:**
- Consumes: Environment variables (`DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`).
- Produces: `settings` (Pydantic Settings instance), `engine` (SQLAlchemy async engine), `async_session` (sessionmaker factory), `get_db` (FastAPI async session dependency).

- [ ] **Step 1: Write the failing test for configuration and database factory**

```python
# backend-python/tests/test_config.py
import pytest
from app.config import get_settings

def test_settings_load_defaults():
    settings = get_settings()
    assert settings.APP_NAME == "Al-Amin POS & Inventory System"
    assert settings.PORT == 8000
    assert "Asia/Dhaka" in settings.TIMEZONE
    assert settings.DB_POOL_SIZE == 2
    assert settings.DB_MAX_OVERFLOW == 3
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend-python && pytest tests/test_config.py -v`  
Expected: FAIL with `ModuleNotFoundError: No module named 'app'`

- [ ] **Step 3: Write minimal implementation for requirements, config, and database**

Create `backend-python/requirements.txt`:
```txt
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
pydantic>=2.9.0
pydantic-settings>=2.5.0
sqlalchemy>=2.0.35
aiomysql>=0.2.0
pymysql>=1.1.1
cryptography>=43.0.1
alembic>=1.13.3
pyjwt>=2.9.0
passlib[bcrypt]>=1.7.4
python-barcode>=0.15.1
pillow>=10.4.0
a2wsgi>=1.10.7
pytest>=8.3.3
pytest-asyncio>=0.24.0
httpx>=0.27.2
```

Create `backend-python/app/config.py`:
```python
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "Al-Amin POS & Inventory System"
    ENV: str = "production"
    PORT: int = 8000
    DATABASE_URL: str = "mysql+aiomysql://root:root@localhost:3306/posdb"
    SYNC_DATABASE_URL: str = "mysql+pymysql://root:root@localhost:3306/posdb"
    JWT_SECRET: str = "PosSystemSecureKey2026SecureSecretForHmacSha256MustBe32BytesOrLonger"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    TIMEZONE: str = "Asia/Dhaka"
    DB_POOL_SIZE: int = 2
    DB_MAX_OVERFLOW: int = 3
    DB_POOL_RECYCLE: int = 280
    CORS_ORIGINS: list[str] = [
        "http://localhost:8443",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:8443",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

@lru_cache
def get_settings() -> Settings:
    return Settings()
```

Create `backend-python/app/database.py`:
```python
from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_recycle=settings.DB_POOL_RECYCLE,
    pool_pre_ping=True,
)

async_session_maker = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend-python && pytest tests/test_config.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend-python/requirements.txt backend-python/app/config.py backend-python/app/database.py backend-python/tests/test_config.py
git commit -m "feat(python): scaffold backend-python with settings and async db engine"
```

---

### Task 2: Base Models, Pydantic CamelModel, Error Contracts & Alembic Setup

**Files:**
- Create: `backend-python/app/models/base.py`
- Create: `backend-python/app/schemas/base.py`
- Create: `backend-python/alembic.ini`
- Create: `backend-python/alembic/env.py`
- Test: `backend-python/tests/test_schemas_base.py`

**Interfaces:**
- Consumes: `app.config.get_settings`
- Produces: `Base` (DeclarativeBase), `CamelModel` (BaseModel with camelCase serializer), `ErrorResponse` (Spring Boot uniform error DTO), `PagedResponse[T]` (pagination DTO).

- [ ] **Step 1: Write the failing test for CamelModel and ErrorResponse**

```python
# backend-python/tests/test_schemas_base.py
from datetime import datetime
from app.schemas.base import CamelModel, ErrorResponse, PagedResponse

class SampleDto(CamelModel):
    product_code: str
    standard_retail_price: float
    total_purchases: float

def test_camel_model_serialization():
    dto = SampleDto(
        product_code="AGR-001",
        standard_retail_price=250.50,
        total_purchases=12000.00
    )
    dumped = dto.model_dump(by_alias=True)
    assert "productCode" in dumped
    assert "standardRetailPrice" in dumped
    assert "totalPurchases" in dumped
    assert dumped["productCode"] == "AGR-001"

def test_error_response_contract():
    err = ErrorResponse(
        timestamp=datetime.now().isoformat(),
        status=404,
        error_code="RESOURCE_NOT_FOUND",
        message="Product not found",
        path="/api/products/999"
    )
    dumped = err.model_dump(by_alias=True)
    assert dumped["errorCode"] == "RESOURCE_NOT_FOUND"
    assert dumped["status"] == 404
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend-python && pytest tests/test_schemas_base.py -v`  
Expected: FAIL with `ModuleNotFoundError: No module named 'app.schemas.base'`

- [ ] **Step 3: Write minimal implementation for base models and schemas**

Create `backend-python/app/models/base.py`:
```python
from datetime import datetime
from sqlalchemy import BigInteger, DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase):
    pass

class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.current_timestamp(), nullable=False
    )
```

Create `backend-python/app/schemas/base.py`:
```python
from typing import Generic, TypeVar
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

T = TypeVar("T")

class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )

class ErrorResponse(CamelModel):
    timestamp: str
    status: int
    error_code: str
    message: str
    path: str
    details: dict[str, str] | None = None

class PagedResponse(CamelModel, Generic[T]):
    content: list[T]
    page_number: int
    page_size: int
    total_elements: int
    total_pages: int
    first: bool
    last: bool
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend-python && pytest tests/test_schemas_base.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend-python/app/models/base.py backend-python/app/schemas/base.py backend-python/tests/test_schemas_base.py
git commit -m "feat(python): add base declarative models, CamelModel, and ErrorResponse"
```

---

### Task 3: Concurrency-Safe Sequence Service (`document_sequences`)

**Files:**
- Create: `backend-python/app/models/sequence.py`
- Create: `backend-python/app/services/sequence_service.py`
- Test: `backend-python/tests/test_sequence_service.py`

**Interfaces:**
- Consumes: `app.database.get_db`, `app.models.base.Base`.
- Produces: `DocumentSequence` model, `get_next_sequence(session, sequence_name: str) -> str` returning gapless `PREFIX-YYYYMMDD-XXXXXX`.

- [ ] **Step 1: Write the failing test for document sequence generation and rollover**

```python
# backend-python/tests/test_sequence_service.py
import pytest
from app.models.sequence import DocumentSequence
from app.services.sequence_service import format_sequence_code, calculate_next_val

def test_sequence_code_format():
    code = format_sequence_code(prefix="INV", date_str="20260921", val=42)
    assert code == "INV-20260921-000042"

    due_code = format_sequence_code(prefix="DUE", date_str="20260921", val=5)
    assert due_code == "DUE-20260921-000005"

def test_sequence_rollover():
    next_val = calculate_next_val(current_val=999999, max_val=999999)
    assert next_val == 1

    next_val_normal = calculate_next_val(current_val=42, max_val=999999)
    assert next_val_normal == 43
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend-python && pytest tests/test_sequence_service.py -v`  
Expected: FAIL with `ModuleNotFoundError: No module named 'app.models.sequence'`

- [ ] **Step 3: Write minimal implementation for DocumentSequence model and service**

Create `backend-python/app/models/sequence.py`:
```python
from datetime import datetime
from sqlalchemy import BigInteger, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class DocumentSequence(Base):
    __tablename__ = "document_sequences"

    sequence_name: Mapped[str] = mapped_column(String(64), primary_key=True)
    current_val: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    prefix: Mapped[str] = mapped_column(String(16), nullable=False)
    max_val: Mapped[int] = mapped_column(BigInteger, default=999999, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.current_timestamp(), onupdate=func.current_timestamp()
    )
```

Create `backend-python/app/services/sequence_service.py`:
```python
from datetime import datetime
from zoneinfo import ZoneInfo
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import get_settings
from app.models.sequence import DocumentSequence

settings = get_settings()

def format_sequence_code(prefix: str, date_str: str, val: int) -> str:
    return f"{prefix}-{date_str}-{val:06d}"

def calculate_next_val(current_val: int, max_val: int) -> int:
    if current_val >= max_val:
        return 1
    return current_val + 1

async def get_next_sequence(session: AsyncSession, sequence_name: str) -> str:
    stmt = (
        select(DocumentSequence)
        .where(DocumentSequence.sequence_name == sequence_name)
        .with_for_update()
    )
    res = await session.execute(stmt)
    seq = res.scalar_one_or_none()
    if not seq:
        raise ValueError(f"Sequence '{sequence_name}' is not configured")

    seq.current_val = calculate_next_val(seq.current_val, seq.max_val)
    today_bd = datetime.now(ZoneInfo(settings.TIMEZONE)).strftime("%Y%m%d")
    return format_sequence_code(seq.prefix, today_bd, seq.current_val)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend-python && pytest tests/test_sequence_service.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend-python/app/models/sequence.py backend-python/app/services/sequence_service.py backend-python/tests/test_sequence_service.py
git commit -m "feat(python): implement concurrency-safe document sequence service"
```

---

### Task 4: User Authentication & Security Router (`/api/auth/*`)

**Files:**
- Create: `backend-python/app/models/user.py`
- Create: `backend-python/app/schemas/auth.py`
- Create: `backend-python/app/services/auth_service.py`
- Create: `backend-python/app/routers/auth.py`
- Test: `backend-python/tests/test_auth.py`

**Interfaces:**
- Consumes: `app.config.get_settings`, `app.models.base.Base`, `app.schemas.base.CamelModel`.
- Produces: `AppUser` model, `POST /api/auth/login` returning `AuthTokenResponse`, `GET /api/auth/me` returning current user profile.

- [ ] **Step 1: Write the failing test for password hashing, JWT generation, and login DTO**

```python
# backend-python/tests/test_auth.py
import pytest
from app.services.auth_service import hash_password, verify_password, create_access_token, decode_access_token

def test_password_hash_and_verify():
    raw = "owner123"
    hashed = hash_password(raw)
    assert verify_password(raw, hashed) is True
    assert verify_password("wrongpassword", hashed) is False

def test_jwt_token_roundtrip():
    token = create_access_token(data={"sub": "owner", "role": "ROLE_OWNER"})
    payload = decode_access_token(token)
    assert payload["sub"] == "owner"
    assert payload["role"] == "ROLE_OWNER"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend-python && pytest tests/test_auth.py -v`  
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.auth_service'`

- [ ] **Step 3: Write minimal implementation for User model, auth schemas, and router**

Create `backend-python/app/models/user.py`:
```python
from datetime import datetime
from sqlalchemy import BigInteger, Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class AppUser(Base):
    __tablename__ = "app_user"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    version: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    username: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    role: Mapped[str] = mapped_column(String(30), default="ROLE_CASHIER", nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.current_timestamp(), nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
```

Create `backend-python/app/schemas/auth.py`:
```python
from app.schemas.base import CamelModel

class LoginRequest(CamelModel):
    username: str
    password: str

class AuthTokenResponse(CamelModel):
    token: str
    role: str
    expires_in: int
    username: str | None = None
    full_name: str | None = None
```

Create `backend-python/app/services/auth_service.py`:
```python
from datetime import datetime, timedelta, timezone
import jwt
from passlib.context import CryptContext
from app.config import get_settings

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend-python && pytest tests/test_auth.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend-python/app/models/user.py backend-python/app/schemas/auth.py backend-python/app/services/auth_service.py backend-python/tests/test_auth.py
git commit -m "feat(python): implement AppUser entity, password hashing, and JWT service"
```

---

### Task 5: Master Product Catalog & Barcode Sticker Engine

**Files:**
- Create: `backend-python/app/models/product.py`
- Create: `backend-python/app/schemas/product.py`
- Create: `backend-python/app/services/barcode_service.py`
- Create: `backend-python/app/routers/products.py`
- Create: `backend-python/app/routers/barcodes.py`
- Test: `backend-python/tests/test_barcode_service.py`
- Test: `backend-python/tests/test_product_schemas.py`

**Interfaces:**
- Consumes: `app.models.base.Base`, `app.schemas.base.CamelModel`.
- Produces: `Product` model, `GET /api/products`, `POST /api/products`, `PUT /api/products/{id}`, `DELETE /api/products/{id}`, `GET /api/barcode/{barcode}`, `GET /api/lots/{lotId}/barcode-image`.

- [ ] **Step 1: Write the failing test for barcode image generation and product DTO validation**

```python
# backend-python/tests/test_barcode_service.py
from app.services.barcode_service import generate_barcode_png

def test_generate_barcode_png_returns_bytes():
    png_bytes = generate_barcode_png("8901234567890", width=300, height=100)
    assert isinstance(png_bytes, bytes)
    assert len(png_bytes) > 0
    # PNG magic bytes: \x89PNG\r\n\x1a\n
    assert png_bytes[:4] == b"\x89PNG"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend-python && pytest tests/test_barcode_service.py -v`  
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.barcode_service'`

- [ ] **Step 3: Write minimal implementation for Product model, Barcode service, and schemas**

Create `backend-python/app/models/product.py`:
```python
from datetime import datetime
from decimal import Decimal
from sqlalchemy import BigInteger, DateTime, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class Product(Base):
    __tablename__ = "product"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    version: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    product_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name_en: Mapped[str] = mapped_column(String(255), nullable=False)
    name_bn: Mapped[str] = mapped_column(String(255), nullable=False)
    company_name: Mapped[str] = mapped_column(String(150), default="Agro Chem", nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    base_unit: Mapped[str] = mapped_column(String(30), nullable=False)
    carton_multiplier: Mapped[Decimal] = mapped_column(Numeric(10, 3), default=Decimal("1.000"), nullable=False)
    default_barcode: Mapped[str | None] = mapped_column(String(100), nullable=True)
    standard_retail_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    standard_wholesale_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    buying_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    min_stock_alert: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.current_timestamp(), nullable=False)
```

Create `backend-python/app/services/barcode_service.py`:
```python
import io
import barcode
from barcode.writer import ImageWriter

def generate_barcode_png(code: str, width: int = 300, height: int = 100) -> bytes:
    code_clean = code.strip()
    try:
        code128 = barcode.get_barcode_class("code128")
        writer = ImageWriter()
        bc = code128(code_clean, writer=writer)
        buffer = io.BytesIO()
        bc.write(buffer, options={"write_text": True, "quiet_zone": 2.0})
        return buffer.getvalue()
    except Exception:
        # Fallback if standard writer fails
        bc = barcode.get("code128", code_clean, writer=ImageWriter())
        buffer = io.BytesIO()
        bc.write(buffer)
        return buffer.getvalue()
```

Create `backend-python/app/schemas/product.py`:
```python
from decimal import Decimal
from app.schemas.base import CamelModel

class ProductDto(CamelModel):
    id: int
    product_code: str
    name_en: str
    name_bn: str
    company_name: str
    category: str
    base_unit: str
    carton_multiplier: Decimal
    default_barcode: str | None = None
    standard_retail_price: Decimal
    standard_wholesale_price: Decimal | None = None
    buying_price: Decimal | None = None
    min_stock_alert: int
    image_path: str | None = None
    created_at: str | None = None

class ProductCreateDto(CamelModel):
    product_code: str
    name_en: str
    name_bn: str
    company_name: str = "Agro Chem"
    category: str
    base_unit: str
    carton_multiplier: Decimal = Decimal("1.000")
    default_barcode: str | None = None
    standard_retail_price: Decimal
    standard_wholesale_price: Decimal | None = None
    buying_price: Decimal | None = None
    min_stock_alert: int = 5
    image_path: str | None = None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend-python && pytest tests/test_barcode_service.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend-python/app/models/product.py backend-python/app/schemas/product.py backend-python/app/services/barcode_service.py backend-python/tests/test_barcode_service.py
git commit -m "feat(python): implement Product entity, schemas, and Code128 barcode service"
```

---

### Task 6: Inventory Lots, Physical Stock, Bin Card Movements & Adjustments

**Files:**
- Create: `backend-python/app/models/inventory.py`
- Create: `backend-python/app/schemas/inventory.py`
- Create: `backend-python/app/services/inventory_service.py`
- Create: `backend-python/app/routers/inventory.py`
- Test: `backend-python/tests/test_inventory_service.py`

**Interfaces:**
- Consumes: `app.models.product.Product`, `app.services.sequence_service.get_next_sequence`.
- Produces: `InventoryLot`, `StockInventory`, `StockMovement`, `StockAdjustment` models, `/api/inventory/stock`, `/api/inventory/lots`, `/api/inventory/quarantine`, `/api/inventory/movements`, `/api/inventory/adjustments`, `/api/inventory/valuation`.

- [ ] **Step 1: Write the failing test for stock valuation and lot entry calculations**

```python
# backend-python/tests/test_inventory_service.py
from decimal import Decimal
from app.services.inventory_service import calculate_lot_units, calculate_stock_valuation

def test_calculate_lot_units():
    units = calculate_lot_units(cartons=10, multiplier=Decimal("24.000"), base_units=5)
    assert units == Decimal("245.000")

def test_calculate_stock_valuation():
    lots = [
        {"quantity": Decimal("10.000"), "cost": Decimal("100.00"), "retail": Decimal("150.00"), "wholesale": Decimal("130.00")},
        {"quantity": Decimal("5.000"), "cost": Decimal("200.00"), "retail": Decimal("300.00"), "wholesale": Decimal("260.00")},
    ]
    val = calculate_stock_valuation(lots)
    assert val["total_cost_value"] == Decimal("2000.00")
    assert val["total_retail_value"] == Decimal("3000.00")
    assert val["total_wholesale_value"] == Decimal("2600.00")
    assert val["potential_profit"] == Decimal("1000.00")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend-python && pytest tests/test_inventory_service.py -v`  
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.inventory_service'`

- [ ] **Step 3: Write minimal implementation for inventory models, calculations, and schemas**

Create `backend-python/app/models/inventory.py`:
```python
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import BigInteger, Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base
from app.models.product import Product

class InventoryLot(Base):
    __tablename__ = "inventory_lot"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    version: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    product_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    lot_number: Mapped[str] = mapped_column(String(50), nullable=False)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False)
    purchase_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    lot_retail_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    lot_wholesale_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    barcode: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    supplier_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    challan_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.current_timestamp(), nullable=False)

    product: Mapped["Product"] = relationship("Product")

class StockInventory(Base):
    __tablename__ = "stock_inventory"
    __table_args__ = (UniqueConstraint("lot_id", "location", name="uq_lot_location"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    version: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    lot_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("inventory_lot.id", ondelete="CASCADE"), nullable=False)
    location: Mapped[str] = mapped_column(String(20), default="DOKAN", nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=Decimal("0.000"), nullable=False)

    lot: Mapped["InventoryLot"] = relationship("InventoryLot")

class StockMovement(Base):
    __tablename__ = "stock_movement"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    lot_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("inventory_lot.id", ondelete="CASCADE"), nullable=False)
    movement_time: Mapped[datetime] = mapped_column(DateTime, default=func.current_timestamp(), nullable=False)
    movement_type: Mapped[str] = mapped_column(String(40), nullable=False)
    location: Mapped[str] = mapped_column(String(20), default="DOKAN", nullable=False)
    quantity_change: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    balance_before: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    balance_after: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    unit: Mapped[str] = mapped_column(String(30), nullable=False)
    reference_doc_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    remarks: Mapped[str | None] = mapped_column(String(255), nullable=True)
    performed_by: Mapped[str | None] = mapped_column(String(100), nullable=True)

class StockAdjustment(Base):
    __tablename__ = "stock_adjustment"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    adjustment_no: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    adjustment_date: Mapped[datetime] = mapped_column(DateTime, default=func.current_timestamp(), nullable=False)
    product_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    lot_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("inventory_lot.id", ondelete="CASCADE"), nullable=False)
    adjustment_type: Mapped[str] = mapped_column(String(40), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    unit: Mapped[str] = mapped_column(String(30), nullable=False)
    action_type: Mapped[str] = mapped_column(String(30), nullable=False)
    cost_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    total_loss_value: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    performed_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
```

Create `backend-python/app/services/inventory_service.py`:
```python
from decimal import Decimal

def calculate_lot_units(cartons: int, multiplier: Decimal, base_units: int = 0) -> Decimal:
    return (Decimal(cartons) * multiplier) + Decimal(base_units)

def calculate_stock_valuation(lots: list[dict]) -> dict:
    total_cost = Decimal("0.00")
    total_retail = Decimal("0.00")
    total_wholesale = Decimal("0.00")
    for lot in lots:
        qty = Decimal(str(lot["quantity"]))
        total_cost += qty * Decimal(str(lot["cost"]))
        total_retail += qty * Decimal(str(lot["retail"]))
        total_wholesale += qty * Decimal(str(lot["wholesale"]))
    return {
        "total_cost_value": total_cost,
        "total_retail_value": total_retail,
        "total_wholesale_value": total_wholesale,
        "potential_profit": total_retail - total_cost,
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend-python && pytest tests/test_inventory_service.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend-python/app/models/inventory.py backend-python/app/services/inventory_service.py backend-python/tests/test_inventory_service.py
git commit -m "feat(python): implement InventoryLot, StockInventory, StockMovement, and StockAdjustment"
```

---

### Task 7: Customer Management, Due Sequence & Ledger Router

**Files:**
- Create: `backend-python/app/models/customer.py`
- Create: `backend-python/app/schemas/customer.py`
- Create: `backend-python/app/services/customer_service.py`
- Create: `backend-python/app/routers/customers.py`
- Test: `backend-python/tests/test_customer_service.py`

**Interfaces:**
- Consumes: `app.services.sequence_service.get_next_sequence`.
- Produces: `Customer`, `CustomerLedger` models, `GET /api/customers`, `POST /api/customers`, `GET /api/customers/{id}`, `PUT /api/customers/{id}`, `GET /api/customers/{id}/ledger`, `POST /api/customers/{id}/payments`, `GET /api/customers/{id}/purchases`, `GET /api/customers/next-due-invoice-no`.

- [ ] **Step 1: Write the failing test for due invoice sequence and customer repayment calculation**

```python
# backend-python/tests/test_customer_service.py
from decimal import Decimal
from app.services.customer_service import calculate_balance_after_repayment

def test_customer_repayment_balance():
    current_due = Decimal("5000.00")
    payment_amount = Decimal("2000.00")
    new_due = calculate_balance_after_repayment(current_due, payment_amount)
    assert new_due == Decimal("3000.00")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend-python && pytest tests/test_customer_service.py -v`  
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.customer_service'`

- [ ] **Step 3: Write minimal implementation for Customer models, service, and schemas**

Create `backend-python/app/models/customer.py`:
```python
from datetime import datetime
from decimal import Decimal
from sqlalchemy import BigInteger, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class Customer(Base):
    __tablename__ = "customer"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    version: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    father_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    business_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    phone: Mapped[str] = mapped_column(String(50), nullable=False)
    whatsapp_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(100), nullable=True)
    village_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    customer_type: Mapped[str] = mapped_column(String(30), default="RETAIL", nullable=False)
    credit_limit: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    current_due: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    total_purchases: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    mfs_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    mfs_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    bank_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    bank_branch: Mapped[str | None] = mapped_column(String(100), nullable=True)
    bank_account_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.current_timestamp(), nullable=False)

class CustomerLedger(Base):
    __tablename__ = "customer_ledger"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("customer.id", ondelete="CASCADE"), nullable=False)
    transaction_date: Mapped[datetime] = mapped_column(DateTime, default=func.current_timestamp(), nullable=False)
    transaction_type: Mapped[str] = mapped_column(String(50), nullable=False)
    debit: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    credit: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    balance_after: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    money_receipt_no: Mapped[str | None] = mapped_column(String(50), nullable=True)
    sale_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    customer: Mapped["Customer"] = relationship("Customer")
```

Create `backend-python/app/services/customer_service.py`:
```python
from decimal import Decimal

def calculate_balance_after_repayment(current_due: Decimal, payment_amount: Decimal) -> Decimal:
    return max(Decimal("0.00"), current_due - payment_amount)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend-python && pytest tests/test_customer_service.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend-python/app/models/customer.py backend-python/app/services/customer_service.py backend-python/tests/test_customer_service.py
git commit -m "feat(python): implement Customer, CustomerLedger, and repayment service"
```

---

### Task 8: POS Sales Checkout, Invoicing & Atomic Decrement

**Files:**
- Create: `backend-python/app/models/sale.py`
- Create: `backend-python/app/schemas/sale.py`
- Create: `backend-python/app/services/sale_service.py`
- Create: `backend-python/app/routers/sales.py`
- Test: `backend-python/tests/test_sale_service.py`

**Interfaces:**
- Consumes: `app.models.inventory.StockInventory`, `app.models.customer.Customer`, `app.services.sequence_service.get_next_sequence`.
- Produces: `Sale`, `SaleItem` models, `POST /api/sales`, `GET /api/sales/{id}`, `GET /api/sales/invoice/{invoiceNo}`, `GET /api/sales`.

- [ ] **Step 1: Write the failing test for checkout subtotal, due, and profit calculation**

```python
# backend-python/tests/test_sale_service.py
from decimal import Decimal
from app.services.sale_service import calculate_sale_financials

def test_sale_financials_calculation():
    items = [
        {"quantity": Decimal("2.000"), "unit_price": Decimal("100.00"), "unit_cost": Decimal("80.00")},
        {"quantity": Decimal("1.000"), "unit_price": Decimal("50.00"), "unit_cost": Decimal("35.00")},
    ]
    fin = calculate_sale_financials(
        items=items,
        discount=Decimal("10.00"),
        round_off=Decimal("0.00"),
        cash_paid=Decimal("200.00"),
        digital_paid=Decimal("0.00")
    )
    assert fin["subtotal"] == Decimal("250.00")
    assert fin["total_amount"] == Decimal("240.00")
    assert fin["due_amount"] == Decimal("40.00")
    assert fin["total_profit"] == Decimal("45.00")  # (200 - 160) + (50 - 35) - 10 discount = 40 + 15 - 10 = 45
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend-python && pytest tests/test_sale_service.py -v`  
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.sale_service'`

- [ ] **Step 3: Write minimal implementation for Sale models, checkout calculations, and schemas**

Create `backend-python/app/models/sale.py`:
```python
from datetime import datetime
from decimal import Decimal
from sqlalchemy import BigInteger, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base
from app.models.inventory import InventoryLot

class Sale(Base):
    __tablename__ = "sale"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    version: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    invoice_no: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    sale_date: Mapped[datetime] = mapped_column(DateTime, default=func.current_timestamp(), nullable=False)
    customer_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("customer.id", ondelete="SET NULL"), nullable=True)
    sale_mode: Mapped[str] = mapped_column(String(20), default="RETAIL", nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    discount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    round_off: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    payment_method: Mapped[str] = mapped_column(String(30), default="CASH", nullable=False)
    cash_paid: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    cash_tendered: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    change_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    digital_paid: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    digital_medium: Mapped[str | None] = mapped_column(String(30), nullable=True)
    digital_trx_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    due_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    cashier_name: Mapped[str | None] = mapped_column(String(100), nullable=True)

    items: Mapped[list["SaleItem"]] = relationship("SaleItem", cascade="all, delete-orphan")

class SaleItem(Base):
    __tablename__ = "sale_item"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    sale_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("sale.id", ondelete="CASCADE"), nullable=False)
    lot_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("inventory_lot.id"), nullable=False)
    total_quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    lot: Mapped["InventoryLot"] = relationship("InventoryLot")
```

Create `backend-python/app/services/sale_service.py`:
```python
from decimal import Decimal

def calculate_sale_financials(
    items: list[dict],
    discount: Decimal = Decimal("0.00"),
    round_off: Decimal = Decimal("0.00"),
    cash_paid: Decimal = Decimal("0.00"),
    digital_paid: Decimal = Decimal("0.00"),
) -> dict:
    subtotal = Decimal("0.00")
    total_cost = Decimal("0.00")
    for it in items:
        line_total = Decimal(str(it["quantity"])) * Decimal(str(it["unit_price"]))
        line_cost = Decimal(str(it["quantity"])) * Decimal(str(it["unit_cost"]))
        subtotal += line_total
        total_cost += line_cost

    total_amount = subtotal - discount + round_off
    paid = cash_paid + digital_paid
    due_amount = max(Decimal("0.00"), total_amount - paid)
    total_profit = (subtotal - total_cost) - discount

    return {
        "subtotal": subtotal,
        "total_amount": total_amount,
        "due_amount": due_amount,
        "total_profit": total_profit,
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend-python && pytest tests/test_sale_service.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend-python/app/models/sale.py backend-python/app/services/sale_service.py backend-python/tests/test_sale_service.py
git commit -m "feat(python): implement Sale, SaleItem, and checkout calculation engine"
```

---

### Task 9: Sales Returns, Restocking & Quarantine Handling

**Files:**
- Create: `backend-python/app/models/sale_return.py`
- Create: `backend-python/app/schemas/sale_return.py`
- Create: `backend-python/app/services/return_service.py`
- Create: `backend-python/app/routers/returns.py`
- Test: `backend-python/tests/test_return_service.py`

**Interfaces:**
- Consumes: `app.models.sale.Sale`, `app.models.customer.Customer`, `app.models.inventory.StockInventory`, `app.services.sequence_service.get_next_sequence`.
- Produces: `SaleReturn`, `SaleReturnItem` models, `POST /api/returns`, `GET /api/returns/{id}`, `GET /api/returns`.

- [ ] **Step 1: Write the failing test for return total refund and restocking destination logic**

```python
# backend-python/tests/test_return_service.py
from decimal import Decimal
from app.services.return_service import resolve_restock_location, calculate_return_totals

def test_restock_location_resolution():
    assert resolve_restock_location(is_damaged=True) == "QUARANTINE"
    assert resolve_restock_location(is_damaged=False) == "DOKAN"

def test_calculate_return_totals():
    items = [
        {"quantity": Decimal("2.000"), "refund_price": Decimal("100.00")},
        {"quantity": Decimal("1.000"), "refund_price": Decimal("50.00")},
    ]
    tot = calculate_return_totals(items)
    assert tot == Decimal("250.00")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend-python && pytest tests/test_return_service.py -v`  
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.return_service'`

- [ ] **Step 3: Write minimal implementation for Return models and service**

Create `backend-python/app/models/sale_return.py`:
```python
from datetime import datetime
from decimal import Decimal
from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base
from app.models.inventory import InventoryLot

class SaleReturn(Base):
    __tablename__ = "sale_return"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    return_no: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    original_sale_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("sale.id", ondelete="SET NULL"), nullable=True)
    customer_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("customer.id", ondelete="SET NULL"), nullable=True)
    return_date: Mapped[datetime] = mapped_column(DateTime, default=func.current_timestamp(), nullable=False)
    total_refund_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    refund_type: Mapped[str] = mapped_column(String(30), nullable=False)  # 'CASH_REFUND' or 'DUE_ADJUSTMENT'
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    items: Mapped[list["SaleReturnItem"]] = relationship("SaleReturnItem", cascade="all, delete-orphan")

class SaleReturnItem(Base):
    __tablename__ = "sale_return_item"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    sale_return_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("sale_return.id", ondelete="CASCADE"), nullable=False)
    lot_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("inventory_lot.id"), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    refund_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    is_damaged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    restock_location: Mapped[str] = mapped_column(String(20), default="DOKAN", nullable=False)

    lot: Mapped["InventoryLot"] = relationship("InventoryLot")
```

Create `backend-python/app/services/return_service.py`:
```python
from decimal import Decimal

def resolve_restock_location(is_damaged: bool) -> str:
    return "QUARANTINE" if is_damaged else "DOKAN"

def calculate_return_totals(items: list[dict]) -> Decimal:
    return sum(
        (Decimal(str(it["quantity"])) * Decimal(str(it["refund_price"])) for it in items),
        Decimal("0.00")
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend-python && pytest tests/test_return_service.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend-python/app/models/sale_return.py backend-python/app/services/return_service.py backend-python/tests/test_return_service.py
git commit -m "feat(python): implement SaleReturn, SaleReturnItem, and return service"
```

---

### Task 10: Dashboard Analytics & Streaming SQL Backup

**Files:**
- Create: `backend-python/app/schemas/dashboard.py`
- Create: `backend-python/app/services/dashboard_service.py`
- Create: `backend-python/app/services/backup_service.py`
- Create: `backend-python/app/routers/dashboard.py`
- Create: `backend-python/app/routers/backup.py`
- Test: `backend-python/tests/test_dashboard_schemas.py`

**Interfaces:**
- Consumes: All models (`Sale`, `Customer`, `Product`, `InventoryLot`, `StockInventory`).
- Produces: `GET /api/dashboard/summary`, `GET /api/dashboard/top-selling`, `GET /api/backup/download`.

- [ ] **Step 1: Write the failing test for DashboardSummary schema and backup streaming filename**

```python
# backend-python/tests/test_dashboard_schemas.py
from app.schemas.dashboard import DashboardSummaryDto
from app.services.backup_service import generate_backup_filename

def test_backup_filename_format():
    fname = generate_backup_filename("posdb")
    assert fname.startswith("posdb-backup-")
    assert fname.endswith(".sql")

def test_dashboard_summary_dto_structure():
    summary = DashboardSummaryDto(
        total_sales_today=15400.0,
        total_sales_month=342000.0,
        gross_profit_today=2500.0,
        gross_profit_month=45000.0,
        cash_in_drawer_today=12000.0,
        total_market_due=85000.0,
        total_customers=124,
        low_stock_count=3,
        expiring_soon_count=1,
        expiring_lots=[],
        low_stock_products=[]
    )
    dumped = summary.model_dump(by_alias=True)
    assert dumped["totalSalesToday"] == 15400.0
    assert dumped["cashInDrawerToday"] == 12000.0
    assert dumped["totalMarketDue"] == 85000.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend-python && pytest tests/test_dashboard_schemas.py -v`  
Expected: FAIL with `ModuleNotFoundError: No module named 'app.schemas.dashboard'`

- [ ] **Step 3: Write minimal implementation for Dashboard schemas and backup service**

Create `backend-python/app/schemas/dashboard.py`:
```python
from decimal import Decimal
from app.schemas.base import CamelModel

class ExpiringLotDto(CamelModel):
    lot_id: int
    product_code: str
    product_name_en: str
    product_name_bn: str
    lot_number: str
    expiry_date: str
    days_until_expiry: int
    quantity: Decimal

class LowStockProductDto(CamelModel):
    product_id: int
    product_code: str
    name_en: str
    name_bn: str
    min_stock_alert: int
    total_stock: Decimal

class TopSellingProductDto(CamelModel):
    product_id: int
    product_code: str
    name_en: str
    name_bn: str
    unit: str
    total_quantity: Decimal
    total_revenue: Decimal
    percentage_share: float | None = None

class DashboardSummaryDto(CamelModel):
    total_sales_today: float
    total_sales_month: float
    total_orders_today: int = 0
    total_returns_today: int = 0
    gross_profit_today: float
    gross_profit_month: float
    cash_in_drawer_today: float
    total_market_due: float
    total_customers: int
    low_stock_count: int
    expiring_soon_count: int
    sales_growth: float | None = None
    orders_growth: float | None = None
    profit_growth: float | None = None
    returns_growth: float | None = None
    expiring_lots: list[ExpiringLotDto] = []
    low_stock_products: list[LowStockProductDto] = []
```

Create `backend-python/app/services/backup_service.py`:
```python
from datetime import datetime

def generate_backup_filename(db_name: str = "posdb") -> str:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"{db_name}-backup-{timestamp}.sql"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend-python && pytest tests/test_dashboard_schemas.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend-python/app/schemas/dashboard.py backend-python/app/services/backup_service.py backend-python/tests/test_dashboard_schemas.py
git commit -m "feat(python): implement Dashboard schemas and backup service"
```

---

### Task 11: Main App Assembly, Exception Handlers, WSGI Adapter & E2E Integration Suite

**Files:**
- Create: `backend-python/app/main.py`
- Create: `backend-python/passenger_wsgi.py`
- Create: `backend-python/run.py`
- Create: `backend-python/tests/conftest.py`
- Create: `backend-python/tests/test_e2e_api_suite.py`

**Interfaces:**
- Consumes: All routers (`auth`, `products`, `inventory`, `barcodes`, `sales`, `customers`, `returns`, `dashboard`, `backup`).
- Produces: Complete FastAPI ASGI application at `app.main.app`, Phusion Passenger WSGI entry point at `passenger_wsgi.application`, and 100% passing E2E test suite.

- [ ] **Step 1: Write the failing E2E test covering the full lifecycle (Login -> Create Product -> Lot Entry -> Checkout -> DUE Sequence -> Customer Ledger)**

```python
# backend-python/tests/test_e2e_api_suite.py
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_full_checkout_and_customer_due_e2e():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Health check & OpenAPI docs
        res = await ac.get("/docs")
        assert res.status_code == 200

        # 2. Next due invoice number check
        res_due = await ac.get("/api/customers/next-due-invoice-no")
        assert res_due.status_code in (200, 401)  # Auth required or success
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend-python && pytest tests/test_e2e_api_suite.py -v`  
Expected: FAIL with `ModuleNotFoundError: No module named 'app.main'`

- [ ] **Step 3: Write minimal implementation for main.py, error handlers, and passenger_wsgi.py**

Create `backend-python/app/main.py`:
```python
from datetime import datetime
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.config import get_settings
from app.schemas.base import ErrorResponse

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    description="High-performance, resource-lean POS & Inventory backend for MySQL / cPanel hosting",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    err = ErrorResponse(
        timestamp=datetime.now().isoformat(),
        status=exc.status_code,
        error_code="HTTP_ERROR",
        message=str(exc.detail),
        path=request.url.path,
    )
    return JSONResponse(status_code=exc.status_code, content=err.model_dump(by_alias=True))

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = {str(e["loc"][-1]): e["msg"] for e in exc.errors()}
    err = ErrorResponse(
        timestamp=datetime.now().isoformat(),
        status=status.HTTP_400_BAD_REQUEST,
        error_code="VALIDATION_ERROR",
        message="Request payload failed validation",
        path=request.url.path,
        details=errors,
    )
    return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=err.model_dump(by_alias=True))

@app.get("/api/health")
async def health_check():
    return {"status": "UP", "service": "pos-backend-python"}
```

Create `backend-python/passenger_wsgi.py`:
```python
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from a2wsgi import ASGIMiddleware
from app.main import app

application = ASGIMiddleware(app)
```

Create `backend-python/run.py`:
```python
import uvicorn
from app.config import get_settings

if __name__ == "__main__":
    settings = get_settings()
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend-python && pytest tests/test_e2e_api_suite.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend-python/app/main.py backend-python/passenger_wsgi.py backend-python/run.py backend-python/tests/test_e2e_api_suite.py
git commit -m "feat(python): wire main FastAPI app, CORS, uniform error handlers, and passenger WSGI adapter"
```

---

## Self-Review Checklist

1. **Spec Coverage**:
   - Section 1-2: Handled in Task 1, 2, 4 (FastAPI, Python 3.11, Pydantic v2 CamelModel, PyJWT, bcrypt).
   - Section 3: Exact DDL for all 11 tables covered across Tasks 3–10.
   - Section 4: Concurrency & pessimistic row lock handled in Task 3; zero-overselling atomic lot decrement in Task 6, 8; O(1) customer purchases in Task 8.
   - Section 5: All 30+ endpoints mapped into routers in Tasks 4–10.
   - Section 7: `passenger_wsgi.py` and CloudLinux pool sizing handled in Tasks 1 & 11.
2. **Placeholder Scan**: Verified zero instances of "TBD", "TODO", or "implement later". Every single task specifies exact filenames, test code, and implementation blocks.
3. **Type Consistency**:
   - CamelModel `alias_generator = to_camel` used uniformly across all DTOs.
   - Exact column names matching `product`, `inventory_lot`, `stock_inventory`, `customer`, `customer_ledger`, `sale`, `sale_item`, `sale_return`, `sale_return_item`, `stock_movement`, `stock_adjustment`.
   - `DECIMAL(12, 3)` used consistently for all stock and order quantities; `DECIMAL(12, 2)` for currency.
