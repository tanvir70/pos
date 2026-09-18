package com.alamin.pos.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardSummaryDto {
    private BigDecimal totalSalesToday;
    private BigDecimal totalSalesMonth;
    private long totalOrdersToday;
    private BigDecimal totalReturnsToday;
    private BigDecimal grossProfitToday;
    private BigDecimal grossProfitMonth;
    private BigDecimal cashInDrawerToday;
    private BigDecimal totalMarketDue;
    private long totalCustomers;
    private long lowStockCount;
    private long expiringSoonCount;
    private Double salesGrowth;
    private Double ordersGrowth;
    private Double profitGrowth;
    private Double returnsGrowth;
    private List<ExpiringLotDto> expiringLots;
    private List<LowStockProductDto> lowStockProducts;
}
