package com.alamin.pos.service;

import com.alamin.pos.entity.InventoryLot;
import com.alamin.pos.repository.InventoryLotRepository;
import com.google.zxing.BinaryBitmap;
import com.google.zxing.LuminanceSource;
import com.google.zxing.MultiFormatReader;
import com.google.zxing.Result;
import com.google.zxing.client.j2se.BufferedImageLuminanceSource;
import com.google.zxing.common.HybridBinarizer;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class BarcodeServiceTest {

    @Autowired
    private BarcodeService barcodeService;

    @Autowired
    private InventoryLotRepository inventoryLotRepository;

    @Autowired
    private MockMvc mockMvc;

    private String decodeBarcode(byte[] imageBytes) throws Exception {
        ByteArrayInputStream bais = new ByteArrayInputStream(imageBytes);
        BufferedImage bufferedImage = ImageIO.read(bais);
        assertThat(bufferedImage).as("Decoded image must not be null").isNotNull();
        LuminanceSource source = new BufferedImageLuminanceSource(bufferedImage);
        BinaryBitmap bitmap = new BinaryBitmap(new HybridBinarizer(source));
        Result result = new MultiFormatReader().decode(bitmap);
        return result.getText();
    }

    @Test
    @DisplayName("1. Generate valid barcode PNG byte array and verify PNG magic bytes")
    void testGenerateBarcodePngValidCode() {
        String barcode = "SYN-AMI-202601";
        byte[] pngBytes = barcodeService.generateBarcodePng(barcode, 300, 100);

        assertThat(pngBytes).isNotNull();
        assertThat(pngBytes.length).isGreaterThan(8);

        // Standard PNG Magic Bytes: 0x89, 'P', 'N', 'G' (0x89, 0x50, 0x4E, 0x47)
        assertThat(pngBytes[0]).isEqualTo((byte) 0x89);
        assertThat(pngBytes[1]).isEqualTo((byte) 'P');
        assertThat(pngBytes[2]).isEqualTo((byte) 'N');
        assertThat(pngBytes[3]).isEqualTo((byte) 'G');
    }

    @Test
    @DisplayName("2. Round-trip decode test: generate barcode PNG and decode back to original text with MultiFormatReader")
    void testRoundTripBarcodeDecode() throws Exception {
        String testCode1 = "SYN-AMI-202601";
        byte[] pngBytes1 = barcodeService.generateBarcodePng(testCode1, 320, 120);
        String decodedText1 = decodeBarcode(pngBytes1);
        assertThat(decodedText1).isEqualTo(testCode1);

        String testCode2 = "SYN-VIR-40WG-LOT-2026A1";
        byte[] pngBytes2 = barcodeService.generateBarcodePng(testCode2, 400, 100);
        String decodedText2 = decodeBarcode(pngBytes2);
        assertThat(decodedText2).isEqualTo(testCode2);
    }

    @Test
    @DisplayName("3. Generate Base64 Data URL and verify round-trip decode of decoded payload")
    void testGenerateBarcodeBase64() throws Exception {
        String barcode = "SYN-REF-202601";
        String base64DataUrl = barcodeService.generateBarcodeBase64(barcode, 300, 100);

        assertThat(base64DataUrl).startsWith("data:image/png;base64,");

        String rawBase64 = base64DataUrl.substring("data:image/png;base64,".length());
        byte[] decodedBytes = Base64.getDecoder().decode(rawBase64);

        assertThat(decodedBytes[0]).isEqualTo((byte) 0x89);
        assertThat(decodedBytes[1]).isEqualTo((byte) 'P');
        assertThat(decodedBytes[2]).isEqualTo((byte) 'N');
        assertThat(decodedBytes[3]).isEqualTo((byte) 'G');

        String decodedText = decodeBarcode(decodedBytes);
        assertThat(decodedText).isEqualTo(barcode);
    }

    @Test
    @DisplayName("4. Verify overloaded methods with default dimensions (300x100)")
    void testDefaultDimensionsOverloads() throws Exception {
        String barcode = "SYN-ISA-202601";
        byte[] pngBytes = barcodeService.generateBarcodePng(barcode);
        assertThat(pngBytes).isNotNull();
        assertThat(decodeBarcode(pngBytes)).isEqualTo(barcode);

        String base64Url = barcodeService.generateBarcodeBase64(barcode);
        assertThat(base64Url).startsWith("data:image/png;base64,");
    }

    @Test
    @DisplayName("5. Test invalid/blank input and zero or negative dimensions")
    void testInvalidAndBlankInputHandling() {
        // Null barcode
        assertThatThrownBy(() -> barcodeService.generateBarcodePng(null, 300, 100))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cannot be null or blank");

        // Empty barcode
        assertThatThrownBy(() -> barcodeService.generateBarcodePng("", 300, 100))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cannot be null or blank");

        // Blank barcode
        assertThatThrownBy(() -> barcodeService.generateBarcodePng("   ", 300, 100))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cannot be null or blank");

        // Invalid width
        assertThatThrownBy(() -> barcodeService.generateBarcodePng("SYN-TEST", 0, 100))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("greater than zero");

        // Invalid height
        assertThatThrownBy(() -> barcodeService.generateBarcodePng("SYN-TEST", 300, -10))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("greater than zero");
    }

    @Test
    @DisplayName("6. GET /api/barcode/{barcode} returns 200 OK, image/png, cache headers and valid decodable image")
    void testGetBarcodeEndpoint() throws Exception {
        String barcode = "SYN-AMI-202601";

        MvcResult result = mockMvc.perform(get("/api/barcode/{barcode}", barcode))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG_VALUE))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "public, max-age=86400"))
                .andReturn();

        byte[] responseBytes = result.getResponse().getContentAsByteArray();
        assertThat(responseBytes).isNotEmpty();
        assertThat(decodeBarcode(responseBytes)).isEqualTo(barcode);
    }

    @Test
    @DisplayName("7. GET /api/barcode/{barcode} with custom width and height query parameters")
    void testGetBarcodeWithCustomDimensions() throws Exception {
        String barcode = "SYN-VIR-202601";

        MvcResult result = mockMvc.perform(get("/api/barcode/{barcode}", barcode)
                        .param("width", "350")
                        .param("height", "120"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG_VALUE))
                .andReturn();

        byte[] responseBytes = result.getResponse().getContentAsByteArray();
        assertThat(responseBytes).isNotEmpty();
        assertThat(decodeBarcode(responseBytes)).isEqualTo(barcode);
    }

    @Test
    @DisplayName("8. GET /api/lots/{lotId}/barcode-image returns 200 OK and barcode image for seeded lot")
    void testGetLotBarcodeImageEndpoint() throws Exception {
        InventoryLot lot = inventoryLotRepository.findByBarcode("SYN-AMI-202502").orElseThrow();

        MvcResult result = mockMvc.perform(get("/api/lots/{lotId}/barcode-image", lot.getId()))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG_VALUE))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "public, max-age=86400"))
                .andReturn();

        byte[] responseBytes = result.getResponse().getContentAsByteArray();
        assertThat(responseBytes).isNotEmpty();
        assertThat(decodeBarcode(responseBytes)).isEqualTo("SYN-AMI-202502");
    }

    @Test
    @DisplayName("9. GET /api/lots/{lotId}/barcode-image with non-existent lot returns 404 Not Found")
    void testGetLotBarcodeImageNotFound() throws Exception {
        mockMvc.perform(get("/api/lots/{lotId}/barcode-image", 999999L))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("10. GET /api/barcode/{barcode} with invalid dimensions returns 400 Bad Request")
    void testGetBarcodeInvalidDimensions() throws Exception {
        mockMvc.perform(get("/api/barcode/{barcode}", "SYN-TEST")
                        .param("width", "0")
                        .param("height", "100"))
                .andExpect(status().isBadRequest());
    }
}
