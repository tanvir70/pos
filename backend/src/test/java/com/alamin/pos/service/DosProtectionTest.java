package com.alamin.pos.service;

import com.alamin.pos.exception.ValidationException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class DosProtectionTest {

    @Autowired
    private BackupService backupService;

    @Autowired
    private BarcodeService barcodeService;

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("1. Backup Streaming: streamSqlBackup streams SQL without heap-buffering entire script")
    void testBackupStreaming() {
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        backupService.streamSqlBackup(outputStream);

        String sqlOutput = outputStream.toString();
        assertThat(sqlOutput).isNotEmpty();
        assertThat(sqlOutput).contains("CREATE ");
        assertThat(sqlOutput).contains("INSERT INTO ");
    }

    @Test
    @WithMockUser(roles = "OWNER")
    @DisplayName("2. Backup Streaming via HTTP: GET /api/backup/download streams directly to client")
    void testHttpBackupStreaming() throws Exception {
        mockMvc.perform(get("/api/backup/download"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, "application/sql"))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, org.hamcrest.Matchers.startsWith("attachment; filename=\"syngenta-pos-backup-")))
                .andExpect(content().string(containsString("CREATE ")))
                .andExpect(content().string(containsString("INSERT INTO ")));
    }

    @Test
    @DisplayName("3. Barcode DoS: Requesting absurd dimensions (50,000 x 50,000) is clamped to max limits (1000 x 300)")
    void testBarcodeDimensionClampingForHugeValues() throws Exception {
        byte[] imageBytes = barcodeService.generateBarcodePng("SYN-DOS-TEST", 50000, 50000);
        assertThat(imageBytes).isNotEmpty();

        BufferedImage image = ImageIO.read(new ByteArrayInputStream(imageBytes));
        assertThat(image).isNotNull();
        assertThat(image.getWidth()).isLessThanOrEqualTo(1000);
        assertThat(image.getHeight()).isLessThanOrEqualTo(300);
    }

    @Test
    @DisplayName("4. Barcode DoS: Requesting tiny dimensions (10 x 5) is clamped to min limits (100 x 30)")
    void testBarcodeDimensionClampingForTinyValues() throws Exception {
        byte[] imageBytes = barcodeService.generateBarcodePng("SYN-DOS-TEST", 10, 5);
        assertThat(imageBytes).isNotEmpty();

        BufferedImage image = ImageIO.read(new ByteArrayInputStream(imageBytes));
        assertThat(image).isNotNull();
        assertThat(image.getWidth()).isGreaterThanOrEqualTo(100);
        assertThat(image.getHeight()).isGreaterThanOrEqualTo(30);
    }

    @Test
    @DisplayName("5. Barcode DoS: Zero or negative dimensions are rejected with ValidationException")
    void testBarcodeRejectsZeroOrNegative() {
        assertThatThrownBy(() -> barcodeService.generateBarcodePng("SYN-DOS-TEST", 0, 100))
                .isInstanceOf(ValidationException.class);

        assertThatThrownBy(() -> barcodeService.generateBarcodePng("SYN-DOS-TEST", 100, -5))
                .isInstanceOf(ValidationException.class);
    }
}
