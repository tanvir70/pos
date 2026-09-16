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
public class SaleReturnItemRequest {

    @NotNull(message = "Lot ID is required")
    private Long lotId;

    @NotNull(message = "Return quantity is required")
    @DecimalMin(value = "0.001", message = "Return quantity must be greater than zero")
    private BigDecimal quantity;

    @NotNull(message = "Refund price is required")
    @DecimalMin(value = "0.00", message = "Refund price cannot be negative")
    private BigDecimal refundPrice;

    @Builder.Default
    private Boolean isDamaged = false;

    // 'DOKAN' or 'GODOWN', default 'DOKAN'
    @Builder.Default
    private String restockLocation = "DOKAN";
}
