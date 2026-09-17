package com.alamin.pos.service;

public interface BackupService {

    byte[] exportSqlBackup();

    String getBackupFileName();
}
