package com.alamin.pos.service;

/**
 * @deprecated Use {@link com.alamin.pos.exception.BarcodeGenerationException}
 */
@Deprecated
public class BarcodeGenerationException extends com.alamin.pos.exception.BarcodeGenerationException {

    public BarcodeGenerationException(String message) {
        super(message);
    }

    public BarcodeGenerationException(String message, Throwable cause) {
        super(message, cause);
    }
}
