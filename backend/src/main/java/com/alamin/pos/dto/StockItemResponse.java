package com.alamin.pos.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StockItemResponse {

    // Product details
    private Long productId;
    private String productCode;
    private String productNameEn;
    private String productNameBn;
    private String category;
    private String baseUnit;
    private BigDecimal cartonMultiplier;
    private String defaultBarcode;
    private BigDecimal buyingPrice;

    // Lot details
    private Long lotId;
    private String lotNumber;
    private LocalDate entryDate;
    private LocalDate expiryDate;
    private BigDecimal purchaseCost;
    private BigDecimal lotRetailPrice;
    private BigDecimal lotWholesalePrice;
    private String barcode;

    // Stock levels
    private BigDecimal quantity;
    private BigDecimal quarantineQuantity;
}
