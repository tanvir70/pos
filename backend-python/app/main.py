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
        # Auto-upgrade existing database schema for client_trx_id column
        from sqlalchemy import text
        for table, col in [
            ("sale", "client_trx_id VARCHAR(64)"),
            ("customer_ledger", "client_trx_id VARCHAR(64)"),
            ("sale_return", "client_trx_id VARCHAR(64)"),
        ]:
            try:
                await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col}"))
            except Exception:
                pass  # column already exists

        # Standardize lot numbers: migrate legacy 'DEFAULT' or empty to 'LOT-01'
        try:
            await conn.execute(text("UPDATE inventory_lot SET lot_number = 'LOT-01' WHERE UPPER(lot_number) IN ('DEFAULT', 'INITIAL', '') OR lot_number IS NULL"))
            await conn.execute(text("UPDATE stock_movement SET remarks = REPLACE(REPLACE(remarks, 'DEFAULT', 'LOT-01'), 'default', 'LOT-01') WHERE remarks LIKE '%DEFAULT%' OR remarks LIKE '%default%'"))
        except Exception:
            pass

    # 2. Seed initial data if empty
    from app.database import async_session_maker
    async with async_session_maker() as session:
        # Check if products exist
        res = await session.execute(select(Product))
        if not res.scalars().first():
            # Seed Document Sequences (with 7-digit max_val: 9999999)
            session.add_all([
                DocumentSequence(sequence_name="sale_invoice", current_val=0, prefix="INV", max_val=9999999),
                DocumentSequence(sequence_name="due_invoice", current_val=0, prefix="DUE", max_val=9999999),
                DocumentSequence(sequence_name="sale_return", current_val=0, prefix="RET", max_val=9999999),
                DocumentSequence(sequence_name="stock_adjustment", current_val=1000, prefix="ADJ", max_val=9999999),
            ])

            # Seed AppUser: owner / owner123
            owner_user = AppUser(
                username="owner",
                password_hash=hash_password("owner123"),
                full_name="Shop Owner",
                role="ROLE_OWNER",
                active=True,
            )
            session.add(owner_user)

            # Seed Products matching V1
            p1 = Product(
                product_code="SYN-AMI-TOP", name_en="Amistar Top 325 SC", name_bn="Amistar Top 325 SC",
                company_name="Agro Chem", category="Fungicide", base_unit="Bottle",
                carton_multiplier=Decimal("20.000"), default_barcode="SYN-AMI-202601",
                standard_retail_price=Decimal("650.00"), standard_wholesale_price=Decimal("580.00"),
                buying_price=Decimal("520.00"), min_stock_alert=5, image_path="/images/products/amistar_top.png"
            )
            p2 = Product(
                product_code="SYN-VIR-40WG", name_en="Virtako 40 WG", name_bn="Virtako 40 WG",
                company_name="Agro Chem", category="Insecticide", base_unit="Packet",
                carton_multiplier=Decimal("50.000"), default_barcode="SYN-VIR-40WG",
                standard_retail_price=Decimal("350.00"), standard_wholesale_price=Decimal("310.00"),
                buying_price=Decimal("275.00"), min_stock_alert=10, image_path="/images/products/virtako.png"
            )
            p3 = Product(
                product_code="SYN-REF-500", name_en="Refit 500 EC", name_bn="Refit 500 EC",
                company_name="Agro Chem", category="Herbicide", base_unit="Bottle",
                carton_multiplier=Decimal("20.000"), default_barcode="SYN-REF-500",
                standard_retail_price=Decimal("480.00"), standard_wholesale_price=Decimal("420.00"),
                buying_price=Decimal("380.00"), min_stock_alert=5, image_path="/images/products/refit.png"
            )
            p4 = Product(
                product_code="SYN-ISA-BIO", name_en="Isabion", name_bn="Isabion",
                company_name="Agro Chem", category="Bio-stimulant", base_unit="Bottle",
                carton_multiplier=Decimal("20.000"), default_barcode="SYN-ISA-BIO",
                standard_retail_price=Decimal("320.00"), standard_wholesale_price=Decimal("280.00"),
                buying_price=Decimal("250.00"), min_stock_alert=5, image_path="/images/products/isabion.png"
            )
            p5 = Product(
                product_code="SYN-KAR-25EC", name_en="Karate 2.5 EC", name_bn="Karate 2.5 EC",
                company_name="Agro Chem", category="Insecticide", base_unit="Bottle",
                carton_multiplier=Decimal("20.000"), default_barcode="SYN-KAR-25EC",
                standard_retail_price=Decimal("260.00"), standard_wholesale_price=Decimal("230.00"),
                buying_price=Decimal("200.00"), min_stock_alert=5, image_path="/images/products/karate.png"
            )
            p6 = Product(
                product_code="SYN-SCO-250EC", name_en="Score 250 EC", name_bn="Score 250 EC",
                company_name="Agro Chem", category="Fungicide", base_unit="Bottle",
                carton_multiplier=Decimal("20.000"), default_barcode="SYN-SCO-250EC",
                standard_retail_price=Decimal("420.00"), standard_wholesale_price=Decimal("380.00"),
                buying_price=Decimal("320.00"), min_stock_alert=5, image_path="/images/products/score.png"
            )
            session.add_all([p1, p2, p3, p4, p5, p6])
            await session.flush()

            # Seed Lots
            l1 = InventoryLot(
                product_id=p1.id, lot_number="LOT-01", entry_date=date(2026, 5, 15), expiry_date=date(2030, 12, 31),
                purchase_cost=Decimal("500.00"), lot_retail_price=Decimal("650.00"), lot_wholesale_price=Decimal("580.00"),
                barcode="SYN-AMI-202502"
            )
            l2 = InventoryLot(
                product_id=p1.id, lot_number="LOT-02", entry_date=date(2026, 9, 19), expiry_date=date(2031, 12, 31),
                purchase_cost=Decimal("590.00"), lot_retail_price=Decimal("720.00"), lot_wholesale_price=Decimal("680.00"),
                barcode="SYN-AMI-NEW-202609", supplier_name="Agro Chemical Ltd", challan_no="CH-SYN-202609"
            )
            l3 = InventoryLot(
                product_id=p2.id, lot_number="LOT-01", entry_date=date(2026, 8, 10), expiry_date=date(2030, 12, 31),
                purchase_cost=Decimal("275.00"), lot_retail_price=Decimal("350.00"), lot_wholesale_price=Decimal("310.00"),
                barcode="SYN-VIR-202601"
            )
            l4 = InventoryLot(
                product_id=p3.id, lot_number="LOT-01", entry_date=date(2026, 8, 15), expiry_date=date(2030, 12, 31),
                purchase_cost=Decimal("380.00"), lot_retail_price=Decimal("480.00"), lot_wholesale_price=Decimal("420.00"),
                barcode="SYN-REF-202601"
            )
            l5 = InventoryLot(
                product_id=p4.id, lot_number="LOT-01", entry_date=date(2026, 8, 20), expiry_date=date(2030, 12, 31),
                purchase_cost=Decimal("250.00"), lot_retail_price=Decimal("320.00"), lot_wholesale_price=Decimal("280.00"),
                barcode="SYN-ISA-202601"
            )
            l6 = InventoryLot(
                product_id=p5.id, lot_number="LOT-01", entry_date=date(2026, 8, 25), expiry_date=date(2030, 12, 31),
                purchase_cost=Decimal("200.00"), lot_retail_price=Decimal("260.00"), lot_wholesale_price=Decimal("230.00"),
                barcode="SYN-KAR-202601"
            )
            l7 = InventoryLot(
                product_id=p6.id, lot_number="LOT-01", entry_date=date(2026, 9, 1), expiry_date=date(2030, 12, 31),
                purchase_cost=Decimal("320.00"), lot_retail_price=Decimal("420.00"), lot_wholesale_price=Decimal("380.00"),
                barcode="SYN-SCO-250EC"
            )
            session.add_all([l1, l2, l3, l4, l5, l6, l7])
            await session.flush()

            # Seed Stock
            session.add_all([
                StockInventory(lot_id=l1.id, location="DOKAN", quantity=Decimal("40.000")),
                StockInventory(lot_id=l2.id, location="DOKAN", quantity=Decimal("50.000")),
                StockInventory(lot_id=l3.id, location="DOKAN", quantity=Decimal("25.000")),
                StockInventory(lot_id=l4.id, location="DOKAN", quantity=Decimal("10.000")),
                StockInventory(lot_id=l5.id, location="DOKAN", quantity=Decimal("8.000")),
                StockInventory(lot_id=l6.id, location="DOKAN", quantity=Decimal("12.000")),
                StockInventory(lot_id=l7.id, location="DOKAN", quantity=Decimal("90.000")),
            ])

            # Seed Customers
            c1 = Customer(
                name="মো: রফিকুল ইসলাম", father_name="মো: আজহার আলী", business_name="মেসার্স মদিনা ট্রেডার্স",
                phone="01711000001", whatsapp_number="01711000001", email="modina.traders@example.com",
                village_address="চকবাজার, শেরপুর সদর, শেরপুর", customer_type="WHOLESALE",
                credit_limit=Decimal("100000.00"), current_due=Decimal("15000.00"),
                mfs_type="BKASH", mfs_number="01711000001", bank_name="Islami Bank Bangladesh PLC",
                bank_branch="Sherpur Branch", bank_account_no="20501234567890"
            )
            c2 = Customer(
                name="করিম মিয়া", father_name="আব্দুল করিম", phone="01811000002",
                whatsapp_number="01811000002", village_address="চর শেরপুর, শেরপুর",
                customer_type="RETAIL", credit_limit=Decimal("0.00"), current_due=Decimal("0.00"),
                mfs_type="NAGAD", mfs_number="01811000002"
            )
            session.add_all([c1, c2])
            await session.flush()

            # Seed opening ledger for c1
            session.add(
                CustomerLedger(
                    customer_id=c1.id,
                    transaction_date=datetime(2026, 9, 1, 9, 0),
                    transaction_type="INVOICE_BILL",
                    debit=Decimal("15000.00"),
                    credit=Decimal("0.00"),
                    balance_after=Decimal("15000.00"),
                    notes="Opening balance prior to system migration",
                )
            )
            await session.commit()

    yield

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
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../frontend/dist"))
if os.path.exists(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API endpoint not found")
        index_html = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_html):
            return FileResponse(index_html)
        raise HTTPException(status_code=404, detail="Not found")
