-- ============================================================================
-- V3__enterprise_hardening.sql
-- Syngenta POS & Inventory Management System - Enterprise Hardening Migration
--
-- Compatibility: Dual-compatible with H2 2.x+ and PostgreSQL 10+
-- Adds:
--   1. Optimistic locking (@Version) columns across critical transactional tables
--   2. Atomic database sequences for collision-free document numbering
--   3. Explicit cash tendering and change accounting columns
--   4. Idempotency tracking table for network retry and replay protection
--   5. High-performance composite indexes for financial queries and ledgers
-- ============================================================================

-- 1. Optimistic Locking (version) columns
ALTER TABLE product ADD COLUMN IF NOT EXISTS version BIGINT DEFAULT 0 NOT NULL;
ALTER TABLE inventory_lot ADD COLUMN IF NOT EXISTS version BIGINT DEFAULT 0 NOT NULL;
ALTER TABLE stock_inventory ADD COLUMN IF NOT EXISTS version BIGINT DEFAULT 0 NOT NULL;
ALTER TABLE customer ADD COLUMN IF NOT EXISTS version BIGINT DEFAULT 0 NOT NULL;
ALTER TABLE sale ADD COLUMN IF NOT EXISTS version BIGINT DEFAULT 0 NOT NULL;

-- 2. Atomic Sequences for Document Numbering
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START WITH 1001 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS return_number_seq START WITH 1001 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS transfer_number_seq START WITH 1001 INCREMENT BY 1;

-- 3. Explicit Cash Tendering & Change Accounting
ALTER TABLE sale ADD COLUMN IF NOT EXISTS cash_tendered NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE sale ADD COLUMN IF NOT EXISTS change_amount NUMERIC(12, 2) DEFAULT 0.00;

-- Backfill existing sales to align cash_tendered with cash_paid
UPDATE sale SET cash_tendered = cash_paid, change_amount = 0.00 WHERE cash_tendered IS NULL OR cash_tendered = 0.00;

-- 4. Idempotency Record Table for API Replay & Retry Prevention
CREATE TABLE IF NOT EXISTS idempotency_record (
    id VARCHAR(64) PRIMARY KEY,
    status VARCHAR(20) NOT NULL,
    response_code INT,
    response_body TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Performance & Composite Lookup Indexes
CREATE INDEX IF NOT EXISTS idx_sale_payment_method ON sale(payment_method);
CREATE INDEX IF NOT EXISTS idx_stock_inv_lot_loc ON stock_inventory(lot_id, location);
CREATE INDEX IF NOT EXISTS idx_customer_ledger_cust_date ON customer_ledger(customer_id, transaction_date);
