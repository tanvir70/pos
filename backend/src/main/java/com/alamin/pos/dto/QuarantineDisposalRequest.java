package com.alamin.pos.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuarantineDisposalRequest {

    @NotNull(message = "Lot ID is required")
    private Long lotId;

    @NotNull(message = "Quantity is required")
    @Positive(message = "Disposal quantity must be positive")
    private BigDecimal quantity;

    @NotBlank(message = "Disposal type is required (e.g. WRITE_OFF, SUPPLIER_CLAIM, DESTROYED)")
    private String disposalType;

    private String remarks;
}
