package com.alamin.pos.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuarantineStockResponse {

    private Long productId;
    private String productCode;
    private String productNameEn;
    private String productNameBn;
    private String baseUnit;

    private Long lotId;
    private String lotNumber;
    private String barcode;
    private LocalDate expiryDate;
    private String supplierName;

    private BigDecimal quarantineQuantity;
    private BigDecimal purchaseCost;
    private BigDecimal lotRetailPrice;
    private BigDecimal totalLossValue;
}
