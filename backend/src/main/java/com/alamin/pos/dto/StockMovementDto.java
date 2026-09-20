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
public class StockMovementDto {
    private Long id;
    private Long productId;
    private String productCode;
    private String productNameEn;
    private String productNameBn;
    private Long lotId;
    private String lotNumber;
    private String barcode;
    private LocalDateTime movementTime;
    private String movementType;
    private String location;
    private BigDecimal quantityChange;
    private BigDecimal balanceBefore;
    private BigDecimal balanceAfter;
    private String unit;
    private String referenceDocNo;
    private String remarks;
    private String performedBy;
}
