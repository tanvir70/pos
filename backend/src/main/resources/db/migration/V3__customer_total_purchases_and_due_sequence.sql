-- V3: Customer total purchases and due invoice sequence

ALTER TABLE customer ADD COLUMN IF NOT EXISTS total_purchases NUMERIC(12, 2) NOT NULL DEFAULT 0;

-- Create sequence for simple auto-incrementing due invoice numbers (1 to 999999 with cycling)
CREATE SEQUENCE IF NOT EXISTS due_invoice_number_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 999999 CYCLE;

-- Backfill total_purchases for existing customers from sales
UPDATE customer c
SET total_purchases = COALESCE((
    SELECT SUM(s.total_amount)
    FROM sale s
    WHERE s.customer_id = c.id
), 0);
