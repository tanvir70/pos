package com.alamin.pos.controller;

import com.alamin.pos.service.BackupService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/backup")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class BackupController {

    private final BackupService backupService;

    @GetMapping("/download")
    public ResponseEntity<byte[]> downloadBackup() {
        byte[] backupBytes = backupService.exportSqlBackup();
        String filename = backupService.getBackupFileName();

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("application/sql"))
                .contentLength(backupBytes.length)
                .body(backupBytes);
    }
}
