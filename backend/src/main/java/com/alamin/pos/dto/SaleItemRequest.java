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
public class SaleItemRequest {

    @NotNull(message = "Lot ID is required")
    private Long lotId;

    @NotNull(message = "Total quantity is required")
    @DecimalMin(value = "0.001", message = "Total quantity must be greater than zero")
    private BigDecimal totalQuantity;

    // Optional: if null and godownQuantity is null, default all to dokanQuantity
    private BigDecimal dokanQuantity;

    // Optional
    private BigDecimal godownQuantity;

    // Overridden or standard price
    @NotNull(message = "Unit price is required")
    private BigDecimal unitPrice;
}
