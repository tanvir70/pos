package com.alamin.pos.migration;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class FlywayMigrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("Verify all active schema tables exist and can be queried")
    void testAllActiveTablesExist() {
        List<String> tables = List.of(
                "product",
                "inventory_lot",
                "stock_inventory",
                "customer",
                "customer_ledger",
                "sale",
                "sale_item",
                "sale_return",
                "sale_return_item"
        );

        for (String table : tables) {
            Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class);
            assertThat(count).as("Table %s should exist and return count >= 0", table).isNotNull().isGreaterThanOrEqualTo(0);
        }
    }

    @Test
    @DisplayName("Verify product seed data count >= 5 and specific agrochemical products exist")
    void testProductSeedData() {
        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM product", Integer.class);
        assertThat(count).isGreaterThanOrEqualTo(5);

        List<String> productCodes = jdbcTemplate.queryForList("SELECT product_code FROM product", String.class);
        assertThat(productCodes).contains(
                "SYN-AMI-TOP",
                "SYN-VIR-40WG",
                "SYN-REF-500",
                "SYN-ISA-BIO",
                "SYN-KAR-25EC"
        );

        // Verify product details for Amistar Top 325 SC
        Map<String, Object> amistar = jdbcTemplate.queryForMap(
                "SELECT name_en, name_bn, category, base_unit, carton_multiplier, standard_retail_price, standard_wholesale_price " +
                "FROM product WHERE product_code = 'SYN-AMI-TOP'"
        );
        assertThat(amistar.get("name_en")).isEqualTo("Amistar Top 325 SC");
        assertThat(amistar.get("category")).isEqualTo("Fungicide");
        assertThat(amistar.get("base_unit")).isEqualTo("Bottle");
        assertThat(new BigDecimal(amistar.get("carton_multiplier").toString())).isEqualByComparingTo("20.000");
        assertThat(new BigDecimal(amistar.get("standard_retail_price").toString())).isEqualByComparingTo("650.00");
        assertThat(new BigDecimal(amistar.get("standard_wholesale_price").toString())).isEqualByComparingTo("580.00");
    }

    @Test
    @DisplayName("Verify inventory_lot seed data supports multiple priced lots per SKU")
    void testInventoryLots() {
        Integer lotCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM inventory_lot", Integer.class);
        assertThat(lotCount).isGreaterThanOrEqualTo(7);

        List<Map<String, Object>> amistarLots = jdbcTemplate.queryForList(
                "SELECT lot_number, expiry_date, purchase_cost, lot_retail_price, lot_wholesale_price, barcode FROM inventory_lot " +
                "WHERE product_id = (SELECT id FROM product WHERE product_code = 'SYN-AMI-TOP') " +
                "ORDER BY expiry_date ASC"
        );
        assertThat(amistarLots).hasSizeGreaterThanOrEqualTo(2);
        assertThat(amistarLots)
                .extracting(row -> row.get("lot_number"))
                .contains("DEFAULT", "AMI-NEW-202609");
        assertThat(amistarLots)
                .extracting(row -> row.get("barcode"))
                .contains("SYN-AMI-202502", "SYN-AMI-NEW-202609");

        Map<String, Object> newPriceLot = amistarLots.stream()
                .filter(row -> "AMI-NEW-202609".equals(row.get("lot_number")))
                .findFirst()
                .orElseThrow();
        assertThat(new BigDecimal(newPriceLot.get("purchase_cost").toString())).isEqualByComparingTo("590.00");
        assertThat(new BigDecimal(newPriceLot.get("lot_retail_price").toString())).isEqualByComparingTo("720.00");
        assertThat(new BigDecimal(newPriceLot.get("lot_wholesale_price").toString())).isEqualByComparingTo("680.00");
    }

    @Test
    @DisplayName("Verify stock_inventory has DOKAN records and zero GODOWN records")
    void testStockInventoryLocations() {
        Integer dokanCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM stock_inventory WHERE location = 'DOKAN'", Integer.class);
        Integer godownCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM stock_inventory WHERE location = 'GODOWN'", Integer.class);

        assertThat(dokanCount).as("DOKAN stock allocations exist").isGreaterThan(0);
        assertThat(godownCount).as("GODOWN stock allocations are not part of the baseline").isEqualTo(0);

        // Verify total stock quantity is positive
        BigDecimal totalStock = jdbcTemplate.queryForObject(
                "SELECT SUM(quantity) FROM stock_inventory", BigDecimal.class);
        assertThat(totalStock).isNotNull();
        assertThat(totalStock).isGreaterThan(BigDecimal.ZERO);
    }

    @Test
    @DisplayName("Verify godown_movement table is not part of the baseline")
    void testGodownMovementTableAbsent() {
        org.assertj.core.api.Assertions.assertThatThrownBy(() ->
                jdbcTemplate.execute("SELECT 1 FROM godown_movement LIMIT 1")
        ).isInstanceOf(Exception.class);
    }

    @Test
    @DisplayName("Verify customer records for both WHOLESALE and RETAIL exist")
    void testCustomerSeedData() {
        Map<String, Object> wholesaleCustomer = jdbcTemplate.queryForMap(
                "SELECT name, business_name, phone, customer_type, credit_limit, current_due " +
                "FROM customer WHERE customer_type = 'WHOLESALE' LIMIT 1"
        );
        assertThat(wholesaleCustomer.get("name")).isEqualTo("মো: রফিকুল ইসলাম");
        assertThat(wholesaleCustomer.get("business_name")).isEqualTo("মেসার্স মদিনা ট্রেডার্স");
        assertThat(wholesaleCustomer.get("phone")).isEqualTo("01711000001");
        assertThat(new BigDecimal(wholesaleCustomer.get("credit_limit").toString())).isEqualByComparingTo("100000.00");
        assertThat(new BigDecimal(wholesaleCustomer.get("current_due").toString())).isEqualByComparingTo("15000.00");

        Map<String, Object> retailCustomer = jdbcTemplate.queryForMap(
                "SELECT name, phone, customer_type, current_due FROM customer WHERE customer_type = 'RETAIL' LIMIT 1"
        );
        assertThat(retailCustomer.get("name")).isEqualTo("করিম মিয়া");
        assertThat(retailCustomer.get("phone")).isEqualTo("01811000002");
        assertThat(new BigDecimal(retailCustomer.get("current_due").toString())).isEqualByComparingTo("0.00");
    }

    @Test
    @DisplayName("Verify customer ledger opening balance record exists")
    void testCustomerLedgerOpeningBalance() {
        Integer ledgerCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM customer_ledger", Integer.class);
        assertThat(ledgerCount).isGreaterThanOrEqualTo(1);

        Map<String, Object> ledgerEntry = jdbcTemplate.queryForMap(
                "SELECT cl.transaction_type, cl.debit, cl.credit, cl.balance_after, c.name " +
                "FROM customer_ledger cl JOIN customer c ON cl.customer_id = c.id " +
                "WHERE c.phone = '01711000001'"
        );
        assertThat(ledgerEntry.get("transaction_type")).isEqualTo("INVOICE_BILL");
        assertThat(new BigDecimal(ledgerEntry.get("debit").toString())).isEqualByComparingTo("15000.00");
        assertThat(new BigDecimal(ledgerEntry.get("credit").toString())).isEqualByComparingTo("0.00");
        assertThat(new BigDecimal(ledgerEntry.get("balance_after").toString())).isEqualByComparingTo("15000.00");
    }
}
