import os
import tempfile
import pytest
from alembic.config import Config
from alembic import command
from alembic.script import ScriptDirectory

def test_alembic_configuration_and_head():
    """Verify Alembic finds valid migration history and current head."""
    cfg = Config("alembic.ini")
    script = ScriptDirectory.from_config(cfg)
    heads = script.get_heads()
    assert len(heads) == 1
    assert heads[0] == "1553d6061019"

def test_alembic_upgrade_on_fresh_database():
    """Verify running alembic upgrade head on a clean database creates all tables successfully."""
    fd, tmp_db = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    try:
        cfg = Config("alembic.ini")
        cfg.set_main_option("sqlalchemy.url", f"sqlite+aiosqlite:///{tmp_db}")
        # Run upgrade head
        command.upgrade(cfg, "head")

        # Verify that alembic_version table exists and is at head
        import sqlite3
        conn = sqlite3.connect(tmp_db)
        cursor = conn.cursor()
        cursor.execute("SELECT version_num FROM alembic_version")
        row = cursor.fetchone()
        assert row is not None
        assert row[0] == "1553d6061019"

        # Verify essential business tables exist
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = {r[0] for r in cursor.fetchall()}
        required_tables = {
            "product",
            "inventory_lot",
            "stock_inventory",
            "stock_movement",
            "customer",
            "customer_ledger",
            "sale",
            "sale_item",
            "sale_return",
            "document_sequences",
            "app_user",
        }
        assert required_tables.issubset(tables)
        conn.close()
    finally:
        if os.path.exists(tmp_db):
            os.remove(tmp_db)
