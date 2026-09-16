package com.alamin.pos.service;

public class BarcodeGenerationException extends RuntimeException {

    public BarcodeGenerationException(String message) {
        super(message);
    }

    public BarcodeGenerationException(String message, Throwable cause) {
        super(message, cause);
    }
}
