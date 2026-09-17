package com.alamin.pos.exception;

public class ExpiredLotSaleException extends RuntimeException {
    public ExpiredLotSaleException(String message) {
        super(message);
    }
}
