package com.alamin.pos.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

import java.util.Map;

/**
 * Base abstract application exception extending RuntimeException according to standard Spring architecture.
 * Encapsulates HTTP status code, machine-readable errorCode, and optional validation details.
 */
@Getter
public abstract class PosException extends RuntimeException {

    private final HttpStatus status;
    private final String errorCode;
    private final Map<String, String> details;

    protected PosException(String message, HttpStatus status, String errorCode) {
        super(message);
        this.status = status;
        this.errorCode = errorCode;
        this.details = null;
    }

    protected PosException(String message, HttpStatus status, String errorCode, Map<String, String> details) {
        super(message);
        this.status = status;
        this.errorCode = errorCode;
        this.details = details;
    }

    protected PosException(String message, Throwable cause, HttpStatus status, String errorCode) {
        super(message, cause);
        this.status = status;
        this.errorCode = errorCode;
        this.details = null;
    }
}
