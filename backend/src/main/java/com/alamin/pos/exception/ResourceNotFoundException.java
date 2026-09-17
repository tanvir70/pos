package com.alamin.pos.exception;

import org.springframework.http.HttpStatus;

/**
 * Thrown when a requested entity (Product, Lot, Customer, Sale, Return) is not found in the database.
 * Maps directly to HTTP 404 Not Found.
 */
public class ResourceNotFoundException extends PosException {

    public static final String ERROR_CODE = "RESOURCE_NOT_FOUND";

    public ResourceNotFoundException(String message) {
        super(message, HttpStatus.NOT_FOUND, ERROR_CODE);
    }
}
