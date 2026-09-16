package com.alamin.pos.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SaleReturnRequest {

    // Optional: null for direct receipt-less return
    private Long originalSaleId;

    // Optional: required if refundType is 'DUE_ADJUSTMENT'
    private Long customerId;

    // Required: 'CASH_REFUND' or 'DUE_ADJUSTMENT'
    @NotBlank(message = "Refund type is required")
    private String refundType;

    private String reason;

    @NotEmpty(message = "Sale return must have at least one item")
    @Valid
    private List<SaleReturnItemRequest> items;
}
