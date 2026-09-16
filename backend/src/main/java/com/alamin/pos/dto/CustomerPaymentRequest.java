package com.alamin.pos.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CustomerPaymentRequest {

    @NotNull(message = "Payment amount is required")
    @DecimalMin(value = "0.01", message = "Payment amount must be greater than zero")
    private BigDecimal amount;

    // 'CASH', 'BKASH', 'NAGAD', 'BANK_TRANSFER', default 'CASH'
    @Builder.Default
    private String paymentMethod = "CASH";

    // Optional paper voucher number (e.g. MR No.)
    private String moneyReceiptNo;

    private String notes;
}
