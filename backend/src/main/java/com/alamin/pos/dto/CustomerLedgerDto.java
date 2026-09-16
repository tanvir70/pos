package com.alamin.pos.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CustomerLedgerDto {

    private Long id;
    private Long customerId;
    private String customerName;
    private LocalDateTime transactionDate;
    private String transactionType;
    private BigDecimal debit;
    private BigDecimal credit;
    private BigDecimal balanceAfter;
    private String moneyReceiptNo;
    private Long saleId;
    private String notes;
}
