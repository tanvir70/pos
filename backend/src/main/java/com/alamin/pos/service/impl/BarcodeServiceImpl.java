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

    // BUSINESS DECISION: Uses Code 128 (1D barcode) standard for agrochemical lot sticker labels.
    // Code 128 supports high-density alphanumeric encoding (e.g., SYN-AMI-202601) and is universally
    // readable by retail laser and CCD handheld barcode scanners used in rural agro shops.
    @Override
    public byte[] generateBarcodePng(String barcodeText, int width, int height) {
        if (barcodeText == null || barcodeText.isBlank()) {
            throw new ValidationException("Barcode text cannot be null or blank");
        }
        if (width <= 0 || height <= 0) {
            throw new ValidationException("Barcode dimensions must be greater than zero: " + width + "x" + height);
        }

        try {
            Code128Writer writer = new Code128Writer();
            BitMatrix bitMatrix = writer.encode(barcodeText, BarcodeFormat.CODE_128, width, height);

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

    // BUSINESS DECISION: Returns Base64 data URL ('data:image/png;base64,...') to enable direct inline
    // rendering in HTML / React thermal sticker print templates without secondary HTTP fetch round-trips.
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
