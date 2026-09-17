package com.alamin.pos.exception;

import org.springframework.http.HttpStatus;

/**
 * Thrown when attempting to persist an entity that violates a unique business key constraint (e.g. duplicate phone number).
 * Maps to HTTP 409 Conflict.
 */
public class DuplicateResourceException extends PosException {

    public static final String ERROR_CODE = "DUPLICATE_RESOURCE";

    public DuplicateResourceException(String message) {
        super(message, HttpStatus.CONFLICT, ERROR_CODE);
    }
}
