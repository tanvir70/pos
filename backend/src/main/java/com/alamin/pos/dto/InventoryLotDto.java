package com.alamin.pos.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InventoryLotDto {
    private Long id;
    private Long productId;
    private String productCode;
    private String productNameEn;
    private String lotNumber;
    private LocalDate entryDate;
    private LocalDate expiryDate;
    private BigDecimal purchaseCost;
    private BigDecimal lotRetailPrice;
    private BigDecimal lotWholesalePrice;
    private String barcode;
    private String supplierName;
    private String challanNo;
    private LocalDateTime createdAt;
}
