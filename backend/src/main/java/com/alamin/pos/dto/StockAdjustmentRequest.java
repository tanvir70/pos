package com.alamin.pos.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
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
public class StockAdjustmentRequest {

    @NotNull(message = "Product ID is required")
    private Long productId;

    @NotNull(message = "Lot ID is required")
    private Long lotId;

    @NotBlank(message = "Adjustment type is required")
    private String adjustmentType;

    @NotNull(message = "Quantity is required")
    @DecimalMin(value = "0.001", message = "Quantity must be greater than zero")
    private BigDecimal quantity;

    @Builder.Default
    private String actionType = "SCRAP_DISCARD"; // 'SCRAP_DISCARD' or 'MOVE_TO_QUARANTINE'

    @NotBlank(message = "Reason is required")
    private String reason;

    private String performedBy;
}
