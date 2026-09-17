package com.alamin.pos.service.impl;

import com.alamin.pos.dto.DashboardSummaryDto;
import com.alamin.pos.dto.ExpiringLotDto;
import com.alamin.pos.dto.LowStockProductDto;
import com.alamin.pos.entity.Customer;
import com.alamin.pos.entity.CustomerLedger;
import com.alamin.pos.entity.InventoryLot;
import com.alamin.pos.entity.Product;
import com.alamin.pos.entity.Sale;
import com.alamin.pos.entity.SaleItem;
import com.alamin.pos.entity.SaleReturn;
import com.alamin.pos.entity.StockInventory;
import com.alamin.pos.repository.CustomerLedgerRepository;
import com.alamin.pos.repository.CustomerRepository;
import com.alamin.pos.repository.InventoryLotRepository;
import com.alamin.pos.repository.ProductRepository;
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
import java.util.Objects;

@Slf4j
@Service
@RequiredArgsConstructor
public class DashboardServiceImpl implements DashboardService {

    private final SaleRepository saleRepository;
    private final SaleItemRepository saleItemRepository;
    private final CustomerRepository customerRepository;
    private final CustomerLedgerRepository customerLedgerRepository;
    private final SaleReturnRepository saleReturnRepository;
    private final ProductRepository productRepository;
    private final InventoryLotRepository inventoryLotRepository;
    private final StockInventoryRepository stockInventoryRepository;

    @Override
    @Transactional(readOnly = true)
    public DashboardSummaryDto getSummary() {
        LocalDate today = LocalDate.now();
        LocalDateTime startOfToday = today.atStartOfDay();
        LocalDateTime endOfToday = today.atTime(LocalTime.MAX);
        LocalDateTime startOfMonth = today.withDayOfMonth(1).atStartOfDay();

        // 1. Sales & Gross Profit Today
        List<Sale> salesToday = saleRepository.findBySaleDateBetween(startOfToday, endOfToday);
        BigDecimal totalSalesToday = salesToday.stream()
                .map(Sale::getTotalAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        BigDecimal grossProfitToday = calculateGrossProfit(salesToday);

        // 2. Sales & Gross Profit This Month
        List<Sale> salesMonth = saleRepository.findBySaleDateBetween(startOfMonth, endOfToday);
        BigDecimal totalSalesMonth = salesMonth.stream()
                .map(Sale::getTotalAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        BigDecimal grossProfitMonth = calculateGrossProfit(salesMonth);

        // 3. Live Cash in Drawer Today
        // BUSINESS DECISION: Live Cash in Drawer computes net cash received today across sales cash payments, debt repayment receipts, and cash refunds.
        BigDecimal salesCash = salesToday.stream()
                .map(s -> s.getCashPaid() != null ? s.getCashPaid() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<CustomerLedger> repaymentsToday = customerLedgerRepository
                .findByTransactionDateBetweenAndTransactionType(startOfToday, endOfToday, "CASH_PAYMENT");
        BigDecimal repaymentsCash = repaymentsToday.stream()
                .map(cl -> cl.getCredit() != null ? cl.getCredit() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<SaleReturn> refundsToday = saleReturnRepository
                .findByReturnDateBetweenAndRefundType(startOfToday, endOfToday, "CASH_REFUND");
        BigDecimal refundsCash = refundsToday.stream()
                .map(sr -> sr.getTotalRefundAmount() != null ? sr.getTotalRefundAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal cashInDrawerToday = salesCash.add(repaymentsCash).subtract(refundsCash)
                .setScale(2, RoundingMode.HALF_UP);

        // 4. Total Market Due & Total Customers
        List<Customer> allCustomers = customerRepository.findAll();
        BigDecimal totalMarketDue = allCustomers.stream()
                .map(Customer::getCurrentDue)
                .filter(due -> due != null && due.compareTo(BigDecimal.ZERO) > 0)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        long totalCustomers = allCustomers.size();

        // 5. Low Stock Alerts
        List<Product> allProducts = productRepository.findAll();
        List<LowStockProductDto> lowStockProducts = new ArrayList<>();
        for (Product product : allProducts) {
            BigDecimal totalStock = stockInventoryRepository.sumQuantityByProductId(product.getId());
            if (totalStock == null) {
                totalStock = BigDecimal.ZERO;
            }
            totalStock = totalStock.setScale(3, RoundingMode.HALF_UP);

            int minAlert = product.getMinStockAlert() != null ? product.getMinStockAlert() : 0;
            if (totalStock.compareTo(BigDecimal.valueOf(minAlert)) <= 0) {
                lowStockProducts.add(LowStockProductDto.builder()
                        .productId(product.getId())
                        .productCode(product.getProductCode())
                        .nameEn(product.getNameEn())
                        .nameBn(product.getNameBn())
                        .minStockAlert(minAlert)
                        .totalStock(totalStock)
                        .build());
            }
        }

        // 6. Expiring Lot Alerts (within 30 days)
        // BUSINESS DECISION: Expiring lot alerts include any lot expiring on or before LocalDate.now().plusDays(30) sorted by expiryDate ascending (FEFO priority).
        LocalDate expiryCutoff = today.plusDays(30);
        List<InventoryLot> expiringLotEntities = inventoryLotRepository
                .findByExpiryDateLessThanEqualOrderByExpiryDateAsc(expiryCutoff);
        List<ExpiringLotDto> expiringLots = new ArrayList<>();

        for (InventoryLot lot : expiringLotEntities) {
            Product product = lot.getProduct();
            BigDecimal dokanQty = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "DOKAN")
                    .map(StockInventory::getQuantity)
                    .orElse(BigDecimal.ZERO)
                    .setScale(3, RoundingMode.HALF_UP);

            BigDecimal godownQty = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "GODOWN")
                    .map(StockInventory::getQuantity)
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

    private BigDecimal calculateGrossProfit(List<Sale> sales) {
        if (sales == null || sales.isEmpty()) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }

        List<Long> saleIds = sales.stream().map(Sale::getId).toList();
        List<SaleItem> items = saleItemRepository.findBySaleIdIn(saleIds);

        // BUSINESS DECISION: Gross profit uses frozen sale_item.unit_cost snapshots minus invoice-level discounts to ensure true historical profit accuracy.
        BigDecimal totalLineProfit = items.stream()
                .map(item -> {
                    BigDecimal unitPrice = item.getUnitPrice() != null ? item.getUnitPrice() : BigDecimal.ZERO;
                    BigDecimal unitCost = item.getUnitCost() != null ? item.getUnitCost() : BigDecimal.ZERO;
                    BigDecimal qty = item.getTotalQuantity() != null ? item.getTotalQuantity() : BigDecimal.ZERO;
                    return unitPrice.subtract(unitCost).multiply(qty);
                })
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalDiscounts = sales.stream()
                .map(s -> s.getDiscount() != null ? s.getDiscount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalRoundOff = sales.stream()
                .map(s -> s.getRoundOff() != null ? s.getRoundOff() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return totalLineProfit.subtract(totalDiscounts).subtract(totalRoundOff).setScale(2, RoundingMode.HALF_UP);
    }
}
