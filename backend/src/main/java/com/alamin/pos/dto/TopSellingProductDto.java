package com.alamin.pos.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TopSellingProductDto {
    private Long productId;
    private String productCode;
    private String nameEn;
    private String nameBn;
    private String unit;
    private BigDecimal totalQuantity;
    private BigDecimal totalRevenue;
    private Double percentageShare;
}
