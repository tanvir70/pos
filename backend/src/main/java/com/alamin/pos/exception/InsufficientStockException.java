package com.alamin.pos.exception;

import org.springframework.http.HttpStatus;

/**
 * Thrown when requested stock quantity exceeds available physical balance in bulk warehouse storage (Godown)
 * or when an internal replenishment transfer cannot be fulfilled.
 * Maps to HTTP 422 Unprocessable Entity.
 */
public class InsufficientStockException extends PosException {

    public static final String ERROR_CODE = "INSUFFICIENT_STOCK";

    public InsufficientStockException(String message) {
        super(message, HttpStatus.UNPROCESSABLE_ENTITY, ERROR_CODE);
    }
}
