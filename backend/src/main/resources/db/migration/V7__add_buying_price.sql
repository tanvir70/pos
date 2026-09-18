-- ============================================================================
-- V7__add_buying_price.sql
-- Add buying_price to product and remove strict NOT NULL on standard_wholesale_price
-- ============================================================================

ALTER TABLE product ADD COLUMN IF NOT EXISTS buying_price NUMERIC(12, 2);
ALTER TABLE product ALTER COLUMN standard_wholesale_price DROP NOT NULL;
UPDATE product SET buying_price = standard_wholesale_price WHERE buying_price IS NULL;
