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
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Slf4j
@Service
@RequiredArgsConstructor
public class BackupServiceImpl implements BackupService {

    private final JdbcTemplate jdbcTemplate;

    // BUSINESS DECISION: Streams database backup directly to output stream to prevent heap memory exhaustion on large datasets.
    @Override
    public void streamSqlBackup(OutputStream outputStream) {
        log.info("Streaming SQL database backup dump via H2 SCRIPT query...");
        try {
            BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(outputStream, StandardCharsets.UTF_8));
            jdbcTemplate.query("SCRIPT", rs -> {
                try {
                    String line = rs.getString(1);
                    if (line != null) {
                        writer.write(line);
                        writer.newLine();
                    }
                } catch (IOException e) {
                    throw new RuntimeException("Error writing backup stream", e);
                }
            });
            writer.flush();
        } catch (IOException e) {
            throw new RuntimeException("Error flushing backup stream", e);
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
