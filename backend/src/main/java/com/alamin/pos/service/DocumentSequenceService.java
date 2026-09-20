package com.alamin.pos.service;

public interface DocumentSequenceService {

    String generateInvoiceNumber();

    String generateReturnNumber();

    String generateAdjustmentNumber();
 
    String generateDueReceiptNumber();
}
