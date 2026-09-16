package com.alamin.pos.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SaleRequest {

    // Optional for walk-in retail
    private Long customerId;

    // Required: 'RETAIL' or 'WHOLESALE'
    @NotBlank(message = "Sale mode is required")
    private String saleMode;

    @NotEmpty(message = "At least one sale item is required")
    @Valid
    private List<SaleItemRequest> items;

    @Builder.Default
    private BigDecimal discount = BigDecimal.ZERO;

    @Builder.Default
    private BigDecimal roundOff = BigDecimal.ZERO;

    // Optional: 'CASH', 'BKASH', 'NAGAD', 'BANK_TRANSFER', 'DUE', 'SPLIT', default 'CASH'
    @Builder.Default
    private String paymentMethod = "CASH";

    @Builder.Default
    private BigDecimal cashPaid = BigDecimal.ZERO;

    @Builder.Default
    private BigDecimal digitalPaid = BigDecimal.ZERO;

    // Optional: 'BKASH', 'NAGAD', 'BANK_TRANSFER'
    private String digitalMedium;

    private String digitalTrxId;

    private String cashierName;
}
