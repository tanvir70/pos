package com.alamin.pos.migration;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class FlywayV3MigrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("Verify version column exists across critical entities for optimistic locking")
    void testVersionColumnsExist() {
        List<String> tables = List.of("product", "inventory_lot", "stock_inventory", "customer", "sale");
        for (String table : tables) {
            List<Long> versions = jdbcTemplate.queryForList(
                    "SELECT version FROM " + table + " LIMIT 5", Long.class);
            assertThat(versions).allMatch(v -> v != null && v >= 0);
        }
    }

    @Test
    @DisplayName("Verify document sequences exist and increment properly")
    void testSequencesExist() {
        Long nextInvoice = jdbcTemplate.queryForObject("SELECT NEXTVAL('invoice_number_seq')", Long.class);
        assertThat(nextInvoice).isNotNull().isGreaterThanOrEqualTo(1001L);

        Long nextReturn = jdbcTemplate.queryForObject("SELECT NEXTVAL('return_number_seq')", Long.class);
        assertThat(nextReturn).isNotNull().isGreaterThanOrEqualTo(1001L);

        Long nextTransfer = jdbcTemplate.queryForObject("SELECT NEXTVAL('transfer_number_seq')", Long.class);
        assertThat(nextTransfer).isNotNull().isGreaterThanOrEqualTo(1001L);
    }

    @Test
    @DisplayName("Verify cash_tendered and change_amount columns on sale")
    void testSaleTenderColumns() {
        List<BigDecimal> cashTendered = jdbcTemplate.queryForList(
                "SELECT cash_tendered FROM sale LIMIT 5", BigDecimal.class);
        assertThat(cashTendered).allMatch(c -> c != null && c.compareTo(BigDecimal.ZERO) >= 0);

        List<BigDecimal> changeAmount = jdbcTemplate.queryForList(
                "SELECT change_amount FROM sale LIMIT 5", BigDecimal.class);
        assertThat(changeAmount).allMatch(c -> c != null && c.compareTo(BigDecimal.ZERO) >= 0);
    }

    @Test
    @DisplayName("Verify idempotency_record table exists and accepts records")
    void testIdempotencyRecordTable() {
        jdbcTemplate.update(
                "INSERT INTO idempotency_record (id, status, response_code, response_body) VALUES (?, ?, ?, ?)",
                "test-idem-key-1", "COMPLETED", 200, "{\"success\":true}"
        );

        String status = jdbcTemplate.queryForObject(
                "SELECT status FROM idempotency_record WHERE id = ?",
                String.class,
                "test-idem-key-1"
        );
        assertThat(status).isEqualTo("COMPLETED");

        // Clean up test row
        jdbcTemplate.update("DELETE FROM idempotency_record WHERE id = ?", "test-idem-key-1");
    }
}
