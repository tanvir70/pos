from contextlib import asynccontextmanager
from datetime import date, datetime
from decimal import Decimal
import os
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from app.config import get_settings
from app.database import engine
from app.models.base import Base
from app.models.customer import Customer, CustomerLedger
from app.models.inventory import InventoryLot, StockInventory, StockMovement
from app.models.product import Product
from app.models.sequence import DocumentSequence
from app.models.user import AppUser
from app.routers import (
    auth,
    backup,
    barcode,
    customers,
    dashboard,
    inventory,
    products,
    returns,
    sales,
)
from app.core_logging import get_logger, setup_logging
from app.schemas.base import ErrorResponse
from app.services.auth_service import hash_password

settings = get_settings()
setup_logging()
logger = get_logger("app")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up %s (Environment: %s)...", settings.APP_NAME, settings.ENVIRONMENT)
    # 1. Ensure all tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        if "sqlite" not in settings.DATABASE_URL:
            from sqlalchemy import text
            await conn.execute(text("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"))

        def _migrate_schema_sync(sync_conn):
            from sqlalchemy import inspect, text
            from app.scripts.fix_utf8_bangla import run_utf8_bangla_migration_sync
            try:
                run_utf8_bangla_migration_sync(sync_conn)
            except Exception as e:
                logger.warning("Bangla encoding migration check warning: %s", e)

            sync_conn.execute(text("UPDATE inventory_lot SET lot_number = 'LOT-01' WHERE UPPER(lot_number) IN ('DEFAULT', 'INITIAL', '') OR lot_number IS NULL"))
            sync_conn.execute(text("UPDATE stock_movement SET remarks = REPLACE(REPLACE(remarks, 'DEFAULT', 'LOT-01'), 'default', 'LOT-01') WHERE remarks LIKE '%DEFAULT%' OR remarks LIKE '%default%'"))
            inspector = inspect(sync_conn)
            cols = [c["name"] for c in inspector.get_columns("inventory_lot")]
            if "carton_multiplier" not in cols:
                sync_conn.execute(text("ALTER TABLE inventory_lot ADD COLUMN carton_multiplier NUMERIC(10, 3)"))
            sync_conn.execute(text(
                "UPDATE inventory_lot SET carton_multiplier = "
                "(SELECT product.carton_multiplier FROM product WHERE product.id = inventory_lot.product_id) "
                "WHERE carton_multiplier IS NULL"
            ))

        await conn.run_sync(_migrate_schema_sync)

    # 2. Seed initial data if empty
    # 2. Seed initial data if empty
    from app.database import async_session_maker
    async with async_session_maker() as session:
        # Seed Document Sequences (with 7-digit max_val: 9999999) if not existing
        seq_res = await session.execute(select(DocumentSequence))
        if not seq_res.scalars().first():
            session.add_all([
                DocumentSequence(sequence_name="sale_invoice", current_val=0, prefix="INV", max_val=9999999),
                DocumentSequence(sequence_name="due_invoice", current_val=0, prefix="DUE", max_val=9999999),
                DocumentSequence(sequence_name="sale_return", current_val=0, prefix="RET", max_val=9999999),
                DocumentSequence(sequence_name="stock_adjustment", current_val=0, prefix="ADJ", max_val=9999999),
            ])

        # Seed AppUser: owner / owner123 if not existing
        user_res = await session.execute(select(AppUser).where(AppUser.username == "owner"))
        if not user_res.scalars().first():
            owner_user = AppUser(
                username="owner",
                password_hash=hash_password("owner123"),
                full_name="Shop Owner",
                role="ROLE_OWNER",
                active=True,
            )
            session.add(owner_user)

        # Seed/sync official Syngenta product catalog (preserves custom user prices on reboots)
        await session.commit()
        from app.scripts.seed_syngenta_catalog import seed_syngenta_catalog
        await seed_syngenta_catalog(force_price_reset=False)

        # In TEST environment ONLY: provide isolated test fixtures for e2e / audit suites
        if settings.ENVIRONMENT == "test":
            lots_check = await session.execute(select(InventoryLot))
            if not lots_check.scalars().first():
                # Ensure product with code SYN-AMI-TOP exists for test suite
                p_ami = (await session.execute(select(Product).where(Product.product_code == "SYN-AMI-TOP"))).scalar_one_or_none()
                if not p_ami:
                    p_ami = Product(
                        product_code="SYN-AMI-TOP", name_en="Amistar Top 325 SC", name_bn="Amistar Top 325 SC",
                        company_name="Syngenta Bangladesh Limited", category="Fungicide", base_unit="Bottle",
                        carton_multiplier=Decimal("20.000"), default_barcode="SYN-AMI-TOP",
                        standard_retail_price=Decimal("650.00"), standard_wholesale_price=Decimal("580.00"),
                        buying_price=Decimal("520.00"), min_stock_alert=5
                    )
                    session.add(p_ami)
                    await session.flush()

                l1 = InventoryLot(
                    product_id=p_ami.id, lot_number="LOT-01", entry_date=date(2026, 5, 15), expiry_date=date(2030, 12, 31),
                    purchase_cost=Decimal("500.00"), lot_retail_price=Decimal("650.00"), lot_wholesale_price=Decimal("580.00"),
                    barcode="SYN-AMI-202502"
                )
                session.add(l1)
                await session.flush()
                session.add(StockInventory(lot_id=l1.id, location="DOKAN", quantity=Decimal("100.000")))

                # Also attach lots to initial products so all test lookups succeed
                all_prods = (await session.execute(select(Product).order_by(Product.id.asc()))).scalars().all()
                for p in all_prods[:5]:
                    if p.id != p_ami.id:
                        lot_p = InventoryLot(
                            product_id=p.id, lot_number="LOT-01", entry_date=date(2026, 5, 15), expiry_date=date(2030, 12, 31),
                            purchase_cost=Decimal("200.00"), lot_retail_price=Decimal("300.00"), lot_wholesale_price=Decimal("250.00"),
                            barcode=f"{p.product_code}-01"
                        )
                        session.add(lot_p)
                        await session.flush()
                        session.add(StockInventory(lot_id=lot_p.id, location="DOKAN", quantity=Decimal("100.000")))

                # Test customer for e2e audit flows
                c_check = await session.execute(select(Customer))
                if not c_check.scalars().first():
                    c1 = Customer(
                        name="Audit Test Farmer", phone="01711000001", customer_type="WHOLESALE",
                        credit_limit=Decimal("100000.00"), current_due=Decimal("15000.00")
                    )
                    session.add(c1)
                await session.commit()

    try:
        yield
    finally:
        logger.info("Gracefully shutting down %s...", settings.APP_NAME)
        if "sqlite" in settings.DATABASE_URL:
            try:
                from sqlalchemy import text
                async with engine.begin() as conn:
                    await conn.execute(text("PRAGMA wal_checkpoint(TRUNCATE)"))
                logger.info("SQLite WAL checkpoint (TRUNCATE) successfully executed.")
            except Exception as e:
                logger.warning("Could not execute SQLite WAL checkpoint on shutdown: %s", e)
        await engine.dispose()

app = FastAPI(
    title=settings.APP_NAME,
    description="High-performance, low-memory Python backend for POS & Inventory Management System",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handler formatting into ErrorResponse
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    err = ErrorResponse(
        timestamp=datetime.now().isoformat(),
        status=exc.status_code,
        error_code=f"HTTP_{exc.status_code}",
        message=str(exc.detail),
        path=request.url.path,
    )
    return JSONResponse(status_code=exc.status_code, content=err.model_dump(by_alias=True))

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled 500 error processing %s %s: %s", request.method, request.url.path, exc)
    err = ErrorResponse(
        timestamp=datetime.now().isoformat(),
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        error_code="INTERNAL_SERVER_ERROR",
        message=str(exc),
        path=request.url.path,
    )
    return JSONResponse(status_code=500, content=err.model_dump(by_alias=True))

# Health check endpoint for uptime monitoring & cPanel verification
@app.get("/health", tags=["system"])
@app.get("/api/health", tags=["system"])
async def health_check():
    return {
        "status": "UP",
        "timestamp": datetime.now().isoformat(),
        "app": settings.APP_NAME,
        "environment": settings.ENVIRONMENT,
    }

# Include API Routers
app.include_router(auth.router)
app.include_router(products.router)
app.include_router(inventory.router)
app.include_router(barcode.router)
app.include_router(customers.router)
app.include_router(sales.router)
app.include_router(returns.router)
app.include_router(dashboard.router)
app.include_router(backup.router)

# Optional: Serve React frontend static files if built
frontend_dist_local = os.path.abspath(os.path.join(os.path.dirname(__file__), "../dist"))
frontend_dist_parent = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../frontend/dist"))
frontend_dist = frontend_dist_local if os.path.exists(frontend_dist_local) else frontend_dist_parent

if os.path.exists(frontend_dist):
    class ImmutableStaticFiles(StaticFiles):
        """Serves hashed static assets with 1-year immutable caching."""
        def is_not_modified(self, response_headers, request_headers) -> bool:
            return super().is_not_modified(response_headers, request_headers)

        async def get_response(self, path: str, scope):
            response = await super().get_response(path, scope)
            # 1 Year immutable cache for Vite-hashed bundle assets
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
            return response

    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", ImmutableStaticFiles(directory=assets_dir), name="assets")

    @app.get("/favicon.ico", include_in_schema=False)
    async def serve_favicon():
        fp = os.path.join(frontend_dist, "favicon.ico")
        if os.path.isfile(fp):
            return FileResponse(fp, media_type="image/x-icon")
        raise HTTPException(status_code=404, detail="Favicon not found")

    @app.get("/logo.png", include_in_schema=False)
    async def serve_logo():
        fp = os.path.join(frontend_dist, "logo.png")
        if os.path.isfile(fp):
            return FileResponse(fp, media_type="image/png")
        raise HTTPException(status_code=404, detail="Logo not found")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API endpoint not found")
        if full_path:
            static_file = os.path.join(frontend_dist, full_path)
            if os.path.isfile(static_file):
                return FileResponse(static_file)
        index_html = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_html):
            return FileResponse(
                index_html,
                headers={
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                    "Pragma": "no-cache",
                    "Expires": "0",
                },
            )
        raise HTTPException(status_code=404, detail="Not found")
