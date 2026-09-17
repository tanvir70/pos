-- ============================================================================
-- V4__remove_godown.sql
-- Complete Removal of Godown Warehouse Subsystem
-- Consolidates inventory into single store stock (DOKAN), drops godown_movement,
-- and eliminates split-stock columns from sale_item.
--
-- Compatibility: H2 2.x+ and PostgreSQL 10+
-- ============================================================================

-- 1. Consolidate GODOWN stock into DOKAN store stock
-- First, add any GODOWN quantities to existing DOKAN rows for the same lot
UPDATE stock_inventory
SET quantity = quantity + COALESCE((
    SELECT SUM(g.quantity)
    FROM stock_inventory g
    WHERE g.lot_id = stock_inventory.lot_id AND g.location = 'GODOWN'
), 0)
WHERE location = 'DOKAN'
  AND EXISTS (
      SELECT 1 FROM stock_inventory g
      WHERE g.lot_id = stock_inventory.lot_id AND g.location = 'GODOWN'
  );

-- Second, convert any orphan GODOWN rows (lots with no existing DOKAN row) to DOKAN
UPDATE stock_inventory
SET location = 'DOKAN'
WHERE location = 'GODOWN'
  AND lot_id NOT IN (
      SELECT lot_id FROM stock_inventory WHERE location = 'DOKAN'
  );

-- Delete remaining GODOWN rows (whose quantities were merged)
DELETE FROM stock_inventory WHERE location = 'GODOWN';

-- 2. Drop Godown Movement Audit Table and Transfer Sequence
DROP TABLE IF EXISTS godown_movement;
DROP SEQUENCE IF EXISTS transfer_number_seq;

-- 3. Eliminate Split-Stock Fulfillment Columns from sale_item
ALTER TABLE sale_item DROP COLUMN IF EXISTS dokan_quantity;
ALTER TABLE sale_item DROP COLUMN IF EXISTS godown_quantity;
