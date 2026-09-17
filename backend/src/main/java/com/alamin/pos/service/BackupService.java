package com.alamin.pos.service;

import java.io.OutputStream;

public interface BackupService {

    void streamSqlBackup(OutputStream outputStream);

    byte[] exportSqlBackup();

    String getBackupFileName();
}
