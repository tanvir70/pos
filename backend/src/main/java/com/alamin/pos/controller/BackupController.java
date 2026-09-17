package com.alamin.pos.controller;

import com.alamin.pos.service.BackupService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;

@RestController
@RequestMapping("/api/backup")
@RequiredArgsConstructor
public class BackupController {

    private final BackupService backupService;

    // BUSINESS DECISION: Backup downloads stream directly to the servlet output stream to eliminate in-memory buffering.
    @GetMapping("/download")
    public void downloadBackup(HttpServletResponse response) throws IOException {
        String filename = backupService.getBackupFileName();
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"");
        response.setContentType("application/sql");
        response.setStatus(HttpServletResponse.SC_OK);
        backupService.streamSqlBackup(response.getOutputStream());
        response.flushBuffer();
    }
}
