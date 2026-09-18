-- ============================================================================
-- V6__dashboard_indexes.sql
-- Al-Amin POS & Inventory System - High-Performance Analytics Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sale_date ON sale(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sale_mode_date ON sale(sale_mode, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sale_item_sale_id ON sale_item(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_return_date ON sale_return(return_date DESC);
