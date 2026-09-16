package com.alamin.pos.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SaleItemResponse {

    private Long id;
    private Long lotId;
    private String lotNumber;
    private String barcode;
    private String productNameEn;
    private String productNameBn;
    private BigDecimal totalQuantity;
    private BigDecimal dokanQuantity;
    private BigDecimal godownQuantity;
    private BigDecimal unitPrice;
    private BigDecimal unitCost;
    private BigDecimal subtotal;
    private BigDecimal lineProfit;
}
