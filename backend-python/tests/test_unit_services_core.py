import re
import io
from PIL import Image
import pytest
from sqlalchemy import text
from app.database import engine
from app.main import app, lifespan
from app.services.sequence_service import format_sequence_code, calculate_next_val, get_next_sequence
from app.services.barcode_service import generate_code128_png
from app.services.backup_service import get_backup_filename, stream_sql_backup

# ==============================================================================
# 1. SEQUENCE SERVICE TESTS
# ==============================================================================

def test_format_sequence_code():
    """Unit test format_sequence_code zero-padding and prefix delimiter."""
    assert format_sequence_code("INV", "20260926", 1) == "INV-20260926-0000001"
    assert format_sequence_code("DUE", "20260926", 42) == "DUE-20260926-0000042"
    assert format_sequence_code("RET", "20260926", 9999999) == "RET-20260926-9999999"
    assert format_sequence_code("ADJ", "20260101", 0) == "ADJ-20260101-0000000"

def test_calculate_next_val_boundaries():
    """Unit test calculate_next_val rollover logic."""
    assert calculate_next_val(0, 9999999) == 1
    assert calculate_next_val(500, 9999999) == 501
    assert calculate_next_val(9999998, 9999999) == 9999999
    # Rollover to 1 when current_val >= max_val
    assert calculate_next_val(9999999, 9999999) == 1
    assert calculate_next_val(10000000, 9999999) == 1

@pytest.mark.asyncio
async def test_get_next_sequence_integration():
    """Integration test get_next_sequence with real database session."""
    test_seq_name = f"test_seq_{id(test_get_next_sequence_integration)}"
    async with engine.begin() as conn:
        # 1. First retrieval seeds default sequence record
        from sqlalchemy.ext.asyncio import AsyncSession
        session = AsyncSession(bind=conn)

        code1 = await get_next_sequence(session, test_seq_name)
        assert code1.startswith("TES-")  # First 3 uppercase chars of test_seq
        assert code1.endswith("-0000001")

        # 2. Second retrieval increments to 2
        code2 = await get_next_sequence(session, test_seq_name)
        assert code2.endswith("-0000002")

        # 3. Known predefined sequence names
        inv_code = await get_next_sequence(session, "sale_invoice")
        assert inv_code.startswith("INV-")

        due_code = await get_next_sequence(session, "due_invoice")
        assert due_code.startswith("DUE-")

        ret_code = await get_next_sequence(session, "sale_return")
        assert ret_code.startswith("RET-")

        adj_code = await get_next_sequence(session, "stock_adjustment")
        assert adj_code.startswith("ADJ-")

        # Cleanup test sequence record
        await conn.execute(
            text("DELETE FROM document_sequences WHERE sequence_name = :sname"),
            {"sname": test_seq_name},
        )

# ==============================================================================
# 2. BARCODE SERVICE TESTS
# ==============================================================================

def test_generate_code128_png_raster():
    """Unit test Code128 barcode image generation."""
    # Standard alphanumeric string
    png_bytes = generate_code128_png("SYN-AMI-202601", width=300, height=100)
    assert png_bytes.startswith(b"\x89PNG\r\n\x1a\n")

    # Verify PNG dimensions with Pillow
    img = Image.open(io.BytesIO(png_bytes))
    assert img.format == "PNG"
    assert img.width >= 300
    assert img.height >= 80

def test_generate_code128_png_edge_cases():
    """Unit test Code128 with short string, custom sizing, and non-ASCII fallback."""
    # 1. Minimal length string
    short_png = generate_code128_png("A", width=150, height=60)
    assert short_png.startswith(b"\x89PNG\r\n\x1a\n")
    img_short = Image.open(io.BytesIO(short_png))
    assert img_short.width >= 150

    # 2. String containing non-ASCII / out-of-range characters (fallback space handling)
    mixed_png = generate_code128_png("AGRO-বাংলা-123", width=400, height=120)
    assert mixed_png.startswith(b"\x89PNG\r\n\x1a\n")
    img_mixed = Image.open(io.BytesIO(mixed_png))
    assert img_mixed.width >= 400
    assert img_mixed.height >= 120

# ==============================================================================
# 3. BACKUP SERVICE TESTS
# ==============================================================================

def test_get_backup_filename():
    """Unit test get_backup_filename structure."""
    filename = get_backup_filename()
    assert re.match(r"^pos_backup_\d{8}_\d{6}\.sql$", filename), f"Invalid backup filename: {filename}"

@pytest.mark.asyncio
async def test_stream_sql_backup():
    """Integration test streaming SQL backup generator."""
    async with engine.connect() as conn:
        chunks = []
        async for chunk in stream_sql_backup(conn):
            chunks.append(chunk)

        full_sql = "".join(chunks)

        # 1. Header checks
        assert "-- Al-Amin POS & Inventory Management System - Database Backup" in full_sql
        assert "-- Target Host: cPanel / MySQL / MariaDB / SQLite" in full_sql

        # 2. Foreign key toggle lines
        assert "SET FOREIGN_KEY_CHECKS = 0;" in full_sql
        assert "SET FOREIGN_KEY_CHECKS = 1;" in full_sql
        assert "-- Backup Complete" in full_sql

        # 3. Data tables present (product, app_user, etc.)
        assert "INSERT INTO `product`" in full_sql or "INSERT INTO `app_user`" in full_sql
