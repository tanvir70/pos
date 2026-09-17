package com.alamin.pos.service.impl;

import com.alamin.pos.service.BackupService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.io.BufferedWriter;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.sql.ResultSetMetaData;
import java.sql.Types;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class BackupServiceImpl implements BackupService {

    private final JdbcTemplate jdbcTemplate;

    private static final List<String> BACKUP_TABLES = List.of(
            "idempotency_record",
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

    // BUSINESS DECISION: Streams database backup directly to output stream to prevent heap memory exhaustion on large datasets.
    @Override
    public void streamSqlBackup(OutputStream outputStream) {
        log.info("Streaming SQL database backup dump for PostgreSQL...");
        try (BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(outputStream, StandardCharsets.UTF_8))) {
            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
            writer.write("-- ============================================================================");
            writer.newLine();
            writer.write("-- Syngenta POS & Agrochemical Dealership System - Database Backup");
            writer.newLine();
            writer.write("-- Generated at: " + timestamp);
            writer.newLine();
            writer.write("-- Database Engine: PostgreSQL");
            writer.newLine();
            writer.write("-- ============================================================================");
            writer.newLine();
            writer.newLine();

            // Disable foreign key triggers during restore
            writer.write("SET session_replication_role = 'replica';");
            writer.newLine();
            writer.newLine();

            for (String tableName : BACKUP_TABLES) {
                dumpTable(writer, tableName);
            }

            writer.newLine();
            writer.write("SET session_replication_role = 'origin';");
            writer.newLine();
            writer.write("-- ============================================================================");
            writer.newLine();
            writer.write("-- End of Backup Dump");
            writer.newLine();
            writer.write("-- ============================================================================");
            writer.newLine();
            writer.flush();
        } catch (IOException e) {
            log.error("Failed to stream SQL backup", e);
            throw new RuntimeException("Error writing backup stream", e);
        }
    }

    private void dumpTable(BufferedWriter writer, String tableName) throws IOException {
        try {
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT count(*) FROM information_schema.tables WHERE table_name = ?",
                    Integer.class,
                    tableName
            );
            if (count == null || count == 0) {
                return;
            }

            writer.write("-- ----------------------------------------------------------------------------");
            writer.newLine();
            writer.write("-- Table: " + tableName);
            writer.newLine();
            writer.write("-- ----------------------------------------------------------------------------");
            writer.newLine();

            String sql = "SELECT * FROM " + tableName;
            jdbcTemplate.query(sql, rs -> {
                try {
                    ResultSetMetaData meta = rs.getMetaData();
                    int columnCount = meta.getColumnCount();

                    StringBuilder cols = new StringBuilder();
                    for (int i = 1; i <= columnCount; i++) {
                        if (i > 1) cols.append(", ");
                        cols.append(meta.getColumnName(i));
                    }

                    while (rs.next()) {
                        StringBuilder insert = new StringBuilder("INSERT INTO ")
                                .append(tableName)
                                .append(" (")
                                .append(cols)
                                .append(") VALUES (");

                        for (int i = 1; i <= columnCount; i++) {
                            if (i > 1) insert.append(", ");
                            Object val = rs.getObject(i);
                            if (val == null) {
                                insert.append("NULL");
                            } else {
                                int type = meta.getColumnType(i);
                                if (type == Types.NUMERIC || type == Types.DECIMAL ||
                                    type == Types.INTEGER || type == Types.BIGINT ||
                                    type == Types.SMALLINT || type == Types.TINYINT ||
                                    type == Types.FLOAT || type == Types.DOUBLE) {
                                    insert.append(val);
                                } else if (type == Types.BOOLEAN || type == Types.BIT) {
                                    insert.append(val.toString());
                                } else {
                                    String strVal = val.toString().replace("'", "''");
                                    insert.append("'").append(strVal).append("'");
                                }
                            }
                        }
                        insert.append(");");
                        writer.write(insert.toString());
                        writer.newLine();
                    }
                    writer.newLine();
                } catch (Exception e) {
                    throw new RuntimeException("Error dumping table: " + tableName, e);
                }
            });
        } catch (Exception e) {
            log.warn("Could not dump table {}: {}", tableName, e.getMessage());
        }
    }

    @Override
    public byte[] exportSqlBackup() {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        streamSqlBackup(baos);
        return baos.toByteArray();
    }

    @Override
    public String getBackupFileName() {
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss"));
        return "syngenta-pos-backup-" + timestamp + ".sql";
    }
}
