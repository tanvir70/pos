package com.alamin.pos.service.impl;

import com.alamin.pos.service.BackupService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class BackupServiceImpl implements BackupService {

    private final JdbcTemplate jdbcTemplate;

    // BUSINESS DECISION: 1-Click backup engine uses native H2 SCRIPT query via JdbcTemplate to export full DDL and INSERT statements without external CLI tooling or shell execution.
    @Override
    public byte[] exportSqlBackup() {
        log.info("Generating SQL database backup dump via H2 SCRIPT query...");
        List<String> lines = jdbcTemplate.query("SCRIPT", (rs, rowNum) -> rs.getString(1));
        String dump = String.join("\n", lines) + "\n";
        return dump.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    public String getBackupFileName() {
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss"));
        return "syngenta-pos-backup-" + timestamp + ".sql";
    }
}
