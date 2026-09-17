package com.alamin.pos.exception;

import org.springframework.http.HttpStatus;

import java.util.Map;

/**
 * Thrown when request parameter validation fails (e.g. quantity <= 0, split sum mismatch, empty mandatory string).
 * Supports field-level error mapping in details.
 * Maps to HTTP 400 Bad Request.
 */
public class ValidationException extends PosException {

    public static final String ERROR_CODE = "VALIDATION_FAILED";

    public ValidationException(String message) {
        super(message, HttpStatus.BAD_REQUEST, ERROR_CODE);
    }

    public ValidationException(String message, Map<String, String> details) {
        super(message, HttpStatus.BAD_REQUEST, ERROR_CODE, details);
    }
}
