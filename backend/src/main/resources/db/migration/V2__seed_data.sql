-- ============================================================================
-- V2__seed_data.sql
-- Al-Amin POS & Inventory Management System - Initial Seed Data
--
-- Compatibility: Dual-compatible with H2 2.x+ and PostgreSQL 10+
-- Uses portable SELECT subqueries for foreign keys to preserve sequence integrity.
-- ============================================================================

-- 1. Insert Brand Agrochemical Products
INSERT INTO product (
    product_code, name_en, name_bn, company_name, category,
    base_unit, carton_multiplier, default_barcode,
    standard_retail_price, standard_wholesale_price, min_stock_alert, image_path
) VALUES
(
    'SYN-AMI-TOP', 'Amistar Top 325 SC', 'অ্যামিস্টার টপ ৩২৫ এসসি', 'Agro Chem', 'Fungicide',
    'Bottle', 20.000, 'SYN-AMI-202601',
    650.00, 580.00, 5, '/images/products/amistar_top.png'
),
(
    'SYN-VIR-40WG', 'Virtako 40 WG', 'ভিরতাকো ৪০ ডব্লিউজি', 'Agro Chem', 'Insecticide',
    'Packet', 50.000, 'SYN-VIR-202601',
    350.00, 310.00, 10, '/images/products/virtako.png'
),
(
    'SYN-REF-500', 'Refit 500 EC', 'রিফিট ৫০০ ইসি', 'Agro Chem', 'Herbicide',
    'Bottle', 20.000, 'SYN-REF-202601',
    480.00, 420.00, 5, '/images/products/refit.png'
),
(
    'SYN-ISA-BIO', 'Isabion', 'ইস্যাবিয়ন', 'Agro Chem', 'Bio-stimulant',
    'Bottle', 20.000, 'SYN-ISA-202601',
    320.00, 280.00, 5, '/images/products/isabion.png'
),
(
    'SYN-KAR-25EC', 'Karate 2.5 EC', 'ক্যারাটে ২.৫ ইসি', 'Agro Chem', 'Insecticide',
    'Bottle', 20.000, 'SYN-KAR-202601',
    260.00, 230.00, 5, '/images/products/karate.png'
);

-- 2. Insert Inventory Lots for Products
-- BUSINESS DECISION: Product 1 (Amistar Top) is seeded with two separate lots with different expiry
-- dates to immediately test and enable FEFO (First Expired, First Out) dispatch functionality.
INSERT INTO inventory_lot (
    product_id, lot_number, entry_date, expiry_date,
    purchase_cost, lot_retail_price, lot_wholesale_price,
    barcode, supplier_name, challan_no
) VALUES
(
    (SELECT id FROM product WHERE product_code = 'SYN-AMI-TOP'),
    'LOT-2025B2', '2026-05-15', '2027-12-31',
    500.00, 650.00, 580.00,
    'SYN-AMI-202502', 'Agro Chemical Ltd', 'CH-SYN-7712'
),
(
    (SELECT id FROM product WHERE product_code = 'SYN-AMI-TOP'),
    'LOT-2026A1', '2026-08-01', '2028-06-30',
    520.00, 650.00, 580.00,
    'SYN-AMI-202601', 'Agro Chemical Ltd', 'CH-SYN-8891'
),
(
    (SELECT id FROM product WHERE product_code = 'SYN-VIR-40WG'),
    'LOT-2026V1', '2026-08-10', '2028-07-31',
    275.00, 350.00, 310.00,
    'SYN-VIR-202601', 'Agro Chemical Ltd', 'CH-SYN-8892'
),
(
    (SELECT id FROM product WHERE product_code = 'SYN-REF-500'),
    'LOT-2026R1', '2026-08-15', '2028-08-31',
    380.00, 480.00, 420.00,
    'SYN-REF-202601', 'Agro Chemical Ltd', 'CH-SYN-8893'
),
(
    (SELECT id FROM product WHERE product_code = 'SYN-ISA-BIO'),
    'LOT-2026I1', '2026-08-20', '2028-09-30',
    250.00, 320.00, 280.00,
    'SYN-ISA-202601', 'Agro Chemical Ltd', 'CH-SYN-8894'
),
(
    (SELECT id FROM product WHERE product_code = 'SYN-KAR-25EC'),
    'LOT-2026K1', '2026-08-25', '2028-05-31',
    200.00, 260.00, 230.00,
    'SYN-KAR-202601', 'Agro Chemical Ltd', 'CH-SYN-8895'
);

-- 3. Stock Allocations (DOKAN and GODOWN locations per lot)
INSERT INTO stock_inventory (lot_id, location, quantity) VALUES
-- Amistar Top earlier lot (2025B2)
((SELECT id FROM inventory_lot WHERE barcode = 'SYN-AMI-202502'), 'DOKAN', 10.000),
((SELECT id FROM inventory_lot WHERE barcode = 'SYN-AMI-202502'), 'GODOWN', 30.000),

-- Amistar Top newer lot (2026A1)
((SELECT id FROM inventory_lot WHERE barcode = 'SYN-AMI-202601'), 'DOKAN', 15.000),
((SELECT id FROM inventory_lot WHERE barcode = 'SYN-AMI-202601'), 'GODOWN', 85.000),

-- Virtako 40 WG
((SELECT id FROM inventory_lot WHERE barcode = 'SYN-VIR-202601'), 'DOKAN', 25.000),
((SELECT id FROM inventory_lot WHERE barcode = 'SYN-VIR-202601'), 'GODOWN', 175.000),

-- Refit 500 EC
((SELECT id FROM inventory_lot WHERE barcode = 'SYN-REF-202601'), 'DOKAN', 10.000),
((SELECT id FROM inventory_lot WHERE barcode = 'SYN-REF-202601'), 'GODOWN', 50.000),

-- Isabion
((SELECT id FROM inventory_lot WHERE barcode = 'SYN-ISA-202601'), 'DOKAN', 8.000),
((SELECT id FROM inventory_lot WHERE barcode = 'SYN-ISA-202601'), 'GODOWN', 42.000),

-- Karate 2.5 EC
((SELECT id FROM inventory_lot WHERE barcode = 'SYN-KAR-202601'), 'DOKAN', 12.000),
((SELECT id FROM inventory_lot WHERE barcode = 'SYN-KAR-202601'), 'GODOWN', 48.000);

-- 4. Initial Godown Movement Audit Records (PURCHASE_ENTRY)
INSERT INTO godown_movement (lot_id, movement_type, quantity, movement_date, reference_no, remarks) VALUES
(
    (SELECT id FROM inventory_lot WHERE barcode = 'SYN-AMI-202502'),
    'PURCHASE_ENTRY', 40.000, TIMESTAMP '2026-05-15 10:00:00', 'CH-SYN-7712',
    'Initial shipment received from Agro Chemical Ltd'
),
(
    (SELECT id FROM inventory_lot WHERE barcode = 'SYN-AMI-202601'),
    'PURCHASE_ENTRY', 100.000, TIMESTAMP '2026-08-01 10:00:00', 'CH-SYN-8891',
    'Initial shipment received from Agro Chemical Ltd'
),
(
    (SELECT id FROM inventory_lot WHERE barcode = 'SYN-VIR-202601'),
    'PURCHASE_ENTRY', 200.000, TIMESTAMP '2026-08-10 11:00:00', 'CH-SYN-8892',
    'Initial shipment received from Agro Chemical Ltd'
),
(
    (SELECT id FROM inventory_lot WHERE barcode = 'SYN-REF-202601'),
    'PURCHASE_ENTRY', 60.000, TIMESTAMP '2026-08-15 09:30:00', 'CH-SYN-8893',
    'Initial shipment received from Agro Chemical Ltd'
),
(
    (SELECT id FROM inventory_lot WHERE barcode = 'SYN-ISA-202601'),
    'PURCHASE_ENTRY', 50.000, TIMESTAMP '2026-08-20 14:00:00', 'CH-SYN-8894',
    'Initial shipment received from Agro Chemical Ltd'
),
(
    (SELECT id FROM inventory_lot WHERE barcode = 'SYN-KAR-202601'),
    'PURCHASE_ENTRY', 60.000, TIMESTAMP '2026-08-25 15:30:00', 'CH-SYN-8895',
    'Initial shipment received from Agro Chemical Ltd'
);

-- 5. Customers (Wholesale Sub-dealer and Retail Farmer)
INSERT INTO customer (
    name, father_name, business_name, phone, whatsapp_number,
    email, village_address, customer_type, credit_limit, current_due,
    mfs_type, mfs_number, bank_name, bank_branch, bank_account_no
) VALUES
(
    'মো: রফিকুল ইসলাম', 'মো: আজহার আলী', 'মেসার্স মদিনা ট্রেডার্স', '01711000001', '01711000001',
    'modina.traders@example.com', 'চকবাজার, শেরপুর সদর, শেরপুর', 'WHOLESALE', 100000.00, 15000.00,
    'BKASH', '01711000001', 'Islami Bank Bangladesh PLC', 'Sherpur Branch', '20501234567890'
),
(
    'করিম মিয়া', 'আব্দুল করিম', NULL, '01811000002', '01811000002',
    NULL, 'চর শেরপুর, শেরপুর', 'RETAIL', 0.00, 0.00,
    'NAGAD', '01811000002', NULL, NULL, NULL
);

-- 6. Customer Ledger Initial Opening Due Record
INSERT INTO customer_ledger (
    customer_id, transaction_date, transaction_type,
    debit, credit, balance_after, money_receipt_no, sale_id, notes
) VALUES
(
    (SELECT id FROM customer WHERE phone = '01711000001'),
    TIMESTAMP '2026-09-01 09:00:00', 'INVOICE_BILL',
    15000.00, 0.00, 15000.00, NULL, NULL,
    'পূর্বের বকেয়া হিসাব / Opening balance prior to system migration'
);
