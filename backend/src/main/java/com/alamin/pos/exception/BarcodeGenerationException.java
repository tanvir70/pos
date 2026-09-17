package com.alamin.pos.exception;

import org.springframework.http.HttpStatus;

/**
 * Thrown when barcode generation fails (e.g. invalid ZXing encoding format or stream writing failure).
 * Maps to HTTP 500 Internal Server Error.
 */
public class BarcodeGenerationException extends PosException {

    public static final String ERROR_CODE = "BARCODE_GENERATION_FAILED";

    public BarcodeGenerationException(String message) {
        super(message, HttpStatus.INTERNAL_SERVER_ERROR, ERROR_CODE);
    }

    public BarcodeGenerationException(String message, Throwable cause) {
        super(message, cause, HttpStatus.INTERNAL_SERVER_ERROR, ERROR_CODE);
    }
}
