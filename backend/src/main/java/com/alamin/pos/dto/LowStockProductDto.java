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
public class LowStockProductDto {
    private Long productId;
    private String productCode;
    private String nameEn;
    private String nameBn;
    private int minStockAlert;
    private BigDecimal totalStock;
}
