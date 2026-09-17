package com.alamin.pos.exception;

import org.springframework.http.HttpStatus;

/**
 * Thrown when a business domain rule or invariant is violated
 * (e.g. extending credit to an anonymous walk-in customer, requesting DUE_ADJUSTMENT refund without customer).
 * Maps to HTTP 400 Bad Request.
 */
public class BusinessRuleViolationException extends PosException {

    public static final String ERROR_CODE = "BUSINESS_RULE_VIOLATION";

    public BusinessRuleViolationException(String message) {
        super(message, HttpStatus.BAD_REQUEST, ERROR_CODE);
    }
}
