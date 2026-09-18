package com.alamin.pos.exception;

import org.springframework.http.HttpStatus;

/**
 * Thrown when a login attempt fails due to an unknown username, wrong password,
 * or a deactivated account. Maps to HTTP 401 Unauthorized.
 */
public class InvalidCredentialsException extends PosException {

    public static final String ERROR_CODE = "INVALID_CREDENTIALS";

    public InvalidCredentialsException(String message) {
        super(message, HttpStatus.UNAUTHORIZED, ERROR_CODE);
    }
}
