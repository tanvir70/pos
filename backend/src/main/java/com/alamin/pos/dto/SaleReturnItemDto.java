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
public class SaleReturnItemDto {

    private Long id;
    private Long lotId;
    private String lotNumber;
    private String barcode;
    private String productNameEn;
    private String productNameBn;
    private BigDecimal quantity;
    private BigDecimal refundPrice;
    private Boolean isDamaged;
    private String restockLocation;
    private BigDecimal subtotal;
}
