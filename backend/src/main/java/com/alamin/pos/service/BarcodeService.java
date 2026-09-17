package com.alamin.pos.service;

public interface BarcodeService {

    int DEFAULT_WIDTH = 300;
    int DEFAULT_HEIGHT = 100;

    byte[] generateBarcodePng(String barcodeText, int width, int height);

    byte[] generateBarcodePng(String barcodeText);

    String generateBarcodeBase64(String barcodeText, int width, int height);

    String generateBarcodeBase64(String barcodeText);
}
