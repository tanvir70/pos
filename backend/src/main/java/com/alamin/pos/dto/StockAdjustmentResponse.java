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
public class StockAdjustmentResponse {
    private Long id;
    private String adjustmentNo;
    private LocalDateTime adjustmentDate;
    private Long productId;
    private String productCode;
    private String productNameEn;
    private String productNameBn;
    private Long lotId;
    private String lotNumber;
    private String adjustmentType;
    private BigDecimal quantity;
    private String unit;
    private String actionType;
    private BigDecimal costPrice;
    private BigDecimal totalLossValue;
    private String reason;
    private String performedBy;
}
