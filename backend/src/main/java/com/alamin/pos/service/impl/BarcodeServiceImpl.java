package com.alamin.pos.service.impl;

import com.alamin.pos.exception.BarcodeGenerationException;
import com.alamin.pos.exception.ValidationException;
import com.alamin.pos.service.BarcodeService;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.oned.Code128Writer;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Base64;

@Service
public class BarcodeServiceImpl implements BarcodeService {

    private static final int MIN_WIDTH = 100;
    private static final int MAX_WIDTH = 1000;
    private static final int MIN_HEIGHT = 30;
    private static final int MAX_HEIGHT = 300;

    // BUSINESS DECISION: Uses Code 128 (1D barcode) standard for agrochemical lot sticker labels.
    // Dimensions are clamped to [100..1000] width and [30..300] height to prevent memory allocation DoS attacks.
    @Override
    public byte[] generateBarcodePng(String barcodeText, int width, int height) {
        if (barcodeText == null || barcodeText.isBlank()) {
            throw new ValidationException("Barcode text cannot be null or blank");
        }
        if (width <= 0 || height <= 0) {
            throw new ValidationException("Barcode dimensions must be greater than zero: " + width + "x" + height);
        }

        // Clamp dimensions to prevent image allocation denial of service (DoS)
        int clampedWidth = Math.max(MIN_WIDTH, Math.min(width, MAX_WIDTH));
        int clampedHeight = Math.max(MIN_HEIGHT, Math.min(height, MAX_HEIGHT));

        try {
            Code128Writer writer = new Code128Writer();
            BitMatrix bitMatrix = writer.encode(barcodeText, BarcodeFormat.CODE_128, clampedWidth, clampedHeight);

            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(bitMatrix, "PNG", outputStream);
            return outputStream.toByteArray();
        } catch (IOException e) {
            throw new BarcodeGenerationException("Failed to write barcode PNG image stream", e);
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new BarcodeGenerationException("Failed to generate barcode for text: " + barcodeText, e);
        }
    }

    @Override
    public byte[] generateBarcodePng(String barcodeText) {
        return generateBarcodePng(barcodeText, DEFAULT_WIDTH, DEFAULT_HEIGHT);
    }

    @Override
    public String generateBarcodeBase64(String barcodeText, int width, int height) {
        byte[] pngBytes = generateBarcodePng(barcodeText, width, height);
        return "data:image/png;base64," + Base64.getEncoder().encodeToString(pngBytes);
    }

    @Override
    public String generateBarcodeBase64(String barcodeText) {
        return generateBarcodeBase64(barcodeText, DEFAULT_WIDTH, DEFAULT_HEIGHT);
    }
}
