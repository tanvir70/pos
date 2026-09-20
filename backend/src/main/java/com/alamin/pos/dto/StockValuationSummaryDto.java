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
public class StockValuationSummaryDto {
    private BigDecimal totalCostValuation;
    private BigDecimal totalRetailValuation;
    private BigDecimal totalWholesaleValuation;
    private BigDecimal potentialGrossProfit;
    private BigDecimal totalQuarantineLoss;
    private Long totalActiveLots;
    private Long totalProductsInStock;
    private BigDecimal totalUnitsInStock;
}
