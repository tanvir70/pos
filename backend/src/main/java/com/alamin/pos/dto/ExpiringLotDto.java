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
public class ExpiringLotDto {
    private Long lotId;
    private String productCode;
    private String productNameEn;
    private String productNameBn;
    private String lotNumber;
    private LocalDate expiryDate;
    private long daysUntilExpiry;
    private BigDecimal dokanQuantity;
    private BigDecimal godownQuantity;
}
