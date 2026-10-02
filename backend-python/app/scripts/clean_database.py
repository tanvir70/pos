"""
Database Reset & Cleaning Utility
Rajib Enterprise POS & Inventory System

Performs a clean production reset:
- Cleans all operational/test transactions: sales, sales returns, stock movements,
  stock adjustments, inventory lots, and customer ledgers.
- Deletes dummy/test customers.
- Removes legacy mock products (pack_size IS NULL), preserving only the official 117 Syngenta SKUs.
- Resets all 7-digit document sequences (INV, DUE, RET, ADJ) to 0.
- Preserves app_user (owner account) and Alembic schema version.
- Executes SQLite VACUUM to reclaim storage and defragment.
"""

import os
import sqlite3
import sys

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "pos.db")

def clean_database(db_path: str = DB_PATH):
    if not os.path.exists(db_path):
        print(f"Error: Database file not found at {db_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Connecting to database: {db_path}")
    con = sqlite3.connect(db_path)
    cur = con.cursor()

    try:
        cur.execute("PRAGMA foreign_keys = OFF;")
        cur.execute("BEGIN TRANSACTION;")

        # 1. Operational transaction tables
        print("Clearing transactional records...")
        cur.execute("DELETE FROM sale_return_item;")
        cur.execute("DELETE FROM sale_return;")
        cur.execute("DELETE FROM sale_item;")
        cur.execute("DELETE FROM sale;")
        cur.execute("DELETE FROM stock_movement;")
        cur.execute("DELETE FROM stock_inventory;")
        cur.execute("DELETE FROM stock_adjustment;")
        cur.execute("DELETE FROM customer_ledger;")
        cur.execute("DELETE FROM inventory_lot;")

        # 2. Customers
        print("Clearing test customer records...")
        cur.execute("DELETE FROM customer;")

        # 3. Clean test/dummy products (retain strictly official 117 Syngenta SKUs)
        print("Cleaning non-catalog/test products...")
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from scripts.seed_syngenta_catalog import SYNGENTA_PRODUCTS
        official_codes = [p["agi_code"] for p in SYNGENTA_PRODUCTS]
        placeholders = ",".join("?" for _ in official_codes)
        deleted_products = cur.execute(
            f"DELETE FROM product WHERE product_code NOT IN ({placeholders})",
            official_codes
        ).rowcount
        print(f"Removed {deleted_products} non-catalog test products.")

        # 4. Ensure default owner user exists (owner / owner123)
        cur.execute("SELECT count(*) FROM app_user;")
        if cur.fetchone()[0] == 0:
            from app.services.auth_service import hash_password
            cur.execute(
                "INSERT INTO app_user (username, password_hash, full_name, role, active) VALUES (?, ?, ?, ?, ?)",
                ("owner", hash_password("owner123"), "Shop Owner", "ROLE_OWNER", 1)
            )
            print("Seeded default owner user account (owner / owner123).")

        # 5. Reset document sequences back to 0
        print("Resetting document sequences to 0...")
        seq_configs = [
            ("sale_invoice", "INV", 0, 9999999),
            ("due_invoice", "DUE", 0, 9999999),
            ("sale_return", "RET", 0, 9999999),
            ("stock_adjustment", "ADJ", 0, 9999999),
        ]
        for name, prefix, val, max_v in seq_configs:
            cur.execute(
                """
                INSERT INTO document_sequences (sequence_name, prefix, current_val, max_val, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(sequence_name) DO UPDATE SET current_val = 0, prefix = excluded.prefix, max_val = excluded.max_val, updated_at = CURRENT_TIMESTAMP;
                """,
                (name, prefix, val, max_v)
            )

        con.commit()
        cur.execute("PRAGMA foreign_keys = ON;")
        print("Database transaction committed successfully.")

    except Exception as e:
        con.rollback()
        print(f"Failed to clean database: {e}", file=sys.stderr)
        con.close()
        sys.exit(1)

    # 5. Vacuum database to reclaim space
    print("Vacuuming SQLite database...")
    cur.execute("VACUUM;")

    # 6. Verify and report final table counts
    print("\n--- FINAL VERIFICATION ---")
    tables = [
        "product",
        "customer",
        "app_user",
        "sale",
        "sale_item",
        "sale_return",
        "sale_return_item",
        "inventory_lot",
        "stock_inventory",
        "stock_movement",
        "stock_adjustment",
        "customer_ledger",
        "document_sequences",
        "alembic_version",
    ]

    for tbl in tables:
        cnt = cur.execute(f'SELECT count(*) FROM "{tbl}"').fetchone()[0]
        print(f"  {tbl:20}: {cnt} rows")

    sequences = cur.execute("SELECT sequence_name, prefix, current_val FROM document_sequences").fetchall()
    print("\nDocument Sequences:")
    for seq in sequences:
        print(f"  {seq[0]:20}: prefix={seq[1]}, current_val={seq[2]}")

    con.close()
    print("\nClean production reset completed successfully!")

if __name__ == "__main__":
    clean_database()
