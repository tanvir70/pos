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
public class ProductDto {
    private Long id;
    private String productCode;
    private String nameEn;
    private String nameBn;
    private String companyName;
    private String category;
    private String baseUnit;
    private BigDecimal cartonMultiplier;
    private String defaultBarcode;
    private BigDecimal standardRetailPrice;
    private BigDecimal standardWholesalePrice;
    private Integer minStockAlert;
    private String imagePath;
    private LocalDateTime createdAt;
}
