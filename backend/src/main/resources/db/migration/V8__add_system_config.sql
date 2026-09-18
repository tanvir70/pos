-- ============================================================================
-- V8__add_system_config.sql
-- Al-Amin POS & Inventory Management System - System Configuration
--
-- Compatibility: PostgreSQL 10+
-- Stores persistent dynamic configuration values such as the Owner Security PIN.
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_config (
    config_key VARCHAR(100) PRIMARY KEY,
    config_value VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO system_config (config_key, config_value)
VALUES ('OWNER_PIN', '1234')
ON CONFLICT (config_key) DO NOTHING;
