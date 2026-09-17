package com.alamin.pos.service.impl;

import com.alamin.pos.dto.DashboardSummaryDto;
import com.alamin.pos.dto.ExpiringLotDto;
import com.alamin.pos.dto.LowStockProductDto;
import com.alamin.pos.entity.InventoryLot;
import com.alamin.pos.entity.Product;
import com.alamin.pos.entity.StockInventory;
import com.alamin.pos.repository.CustomerLedgerRepository;
import com.alamin.pos.repository.CustomerRepository;
import com.alamin.pos.repository.InventoryLotRepository;
import com.alamin.pos.repository.SaleItemRepository;
import com.alamin.pos.repository.SaleRepository;
import com.alamin.pos.repository.SaleReturnRepository;
import com.alamin.pos.repository.StockInventoryRepository;
import com.alamin.pos.service.DashboardService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DashboardServiceImpl implements DashboardService {

    private final SaleRepository saleRepository;
    private final SaleItemRepository saleItemRepository;
    private final CustomerRepository customerRepository;
    private final CustomerLedgerRepository customerLedgerRepository;
    private final SaleReturnRepository saleReturnRepository;
    private final InventoryLotRepository inventoryLotRepository;
    private final StockInventoryRepository stockInventoryRepository;

    @Override
    @Transactional(readOnly = true)
    public DashboardSummaryDto getSummary() {
        LocalDate today = LocalDate.now();
        LocalDateTime startOfToday = today.atStartOfDay();
        LocalDateTime endOfToday = today.atTime(LocalTime.MAX);
        LocalDateTime startOfMonth = today.withDayOfMonth(1).atStartOfDay();

        // 1. Sales & Gross Profit Today via single SQL aggregates
        BigDecimal totalSalesToday = saleRepository.sumTotalAmountBySaleDateBetween(startOfToday, endOfToday)
                .setScale(2, RoundingMode.HALF_UP);

        BigDecimal grossProfitToday = calculateGrossProfit(startOfToday, endOfToday);

        // 2. Sales & Gross Profit This Month via single SQL aggregates
        BigDecimal totalSalesMonth = saleRepository.sumTotalAmountBySaleDateBetween(startOfMonth, endOfToday)
                .setScale(2, RoundingMode.HALF_UP);

        BigDecimal grossProfitMonth = calculateGrossProfit(startOfMonth, endOfToday);

        // 3. Live Cash in Drawer Today (Sales Cash + Repayments - Refunds)
        BigDecimal salesCash = saleRepository.sumCashPaidBySaleDateBetween(startOfToday, endOfToday);
        BigDecimal repaymentsCash = customerLedgerRepository.sumCreditByDateBetweenAndTransactionType(
                startOfToday, endOfToday, "CASH_PAYMENT");
        BigDecimal refundsCash = saleReturnRepository.sumRefundAmountByDateBetweenAndRefundType(
                startOfToday, endOfToday, "CASH_REFUND");

        BigDecimal cashInDrawerToday = salesCash.add(repaymentsCash).subtract(refundsCash)
                .setScale(2, RoundingMode.HALF_UP);

        // 4. Total Market Due & Total Customers
        BigDecimal totalMarketDue = customerRepository.sumTotalMarketDue()
                .setScale(2, RoundingMode.HALF_UP);
        long totalCustomers = customerRepository.count();

        // 5. Low Stock Products via single GROUP BY query (eliminates N+1 cascade)
        List<LowStockProductDto> lowStockProducts = stockInventoryRepository.findLowStockProducts();

        // 6. Expiring Lot Alerts (within 30 days) via 2 batch queries (eliminates N+1)
        LocalDate expiryCutoff = today.plusDays(30);
        List<InventoryLot> expiringLotEntities = inventoryLotRepository.findExpiringLotsWithProduct(expiryCutoff);
        List<Long> lotIds = expiringLotEntities.stream().map(InventoryLot::getId).toList();

        Map<Long, List<StockInventory>> stocksByLot = lotIds.isEmpty()
                ? Map.of()
                : stockInventoryRepository.findByLotIdIn(lotIds).stream()
                .collect(Collectors.groupingBy(si -> si.getLot().getId()));

        List<ExpiringLotDto> expiringLots = new ArrayList<>();
        for (InventoryLot lot : expiringLotEntities) {
            Product product = lot.getProduct();
            List<StockInventory> lotStocks = stocksByLot.getOrDefault(lot.getId(), List.of());

            BigDecimal dokanQty = lotStocks.stream()
                    .filter(s -> "DOKAN".equalsIgnoreCase(s.getLocation()))
                    .map(StockInventory::getQuantity)
                    .findFirst()
                    .orElse(BigDecimal.ZERO)
                    .setScale(3, RoundingMode.HALF_UP);

            BigDecimal godownQty = lotStocks.stream()
                    .filter(s -> "GODOWN".equalsIgnoreCase(s.getLocation()))
                    .map(StockInventory::getQuantity)
                    .findFirst()
                    .orElse(BigDecimal.ZERO)
                    .setScale(3, RoundingMode.HALF_UP);

            long daysUntilExpiry = ChronoUnit.DAYS.between(today, lot.getExpiryDate());

            expiringLots.add(ExpiringLotDto.builder()
                    .lotId(lot.getId())
                    .productCode(product != null ? product.getProductCode() : null)
                    .productNameEn(product != null ? product.getNameEn() : null)
                    .productNameBn(product != null ? product.getNameBn() : null)
                    .lotNumber(lot.getLotNumber())
                    .expiryDate(lot.getExpiryDate())
                    .daysUntilExpiry(daysUntilExpiry)
                    .dokanQuantity(dokanQty)
                    .godownQuantity(godownQty)
                    .build());
        }

        return DashboardSummaryDto.builder()
                .totalSalesToday(totalSalesToday)
                .totalSalesMonth(totalSalesMonth)
                .grossProfitToday(grossProfitToday)
                .grossProfitMonth(grossProfitMonth)
                .cashInDrawerToday(cashInDrawerToday)
                .totalMarketDue(totalMarketDue)
                .totalCustomers(totalCustomers)
                .lowStockCount(lowStockProducts.size())
                .expiringSoonCount(expiringLots.size())
                .expiringLots(expiringLots)
                .lowStockProducts(lowStockProducts)
                .build();
    }

    private BigDecimal calculateGrossProfit(LocalDateTime start, LocalDateTime end) {
        BigDecimal totalLineProfit = saleItemRepository.sumLineProfitBySaleDateBetween(start, end);
        BigDecimal totalDiscountsAndRoundOff = saleRepository.sumDiscountsAndRoundOffBySaleDateBetween(start, end);
        return totalLineProfit.subtract(totalDiscountsAndRoundOff).setScale(2, RoundingMode.HALF_UP);
    }
}
