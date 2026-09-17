package com.alamin.pos.e2e;

import com.alamin.pos.dto.SaleItemRequest;
import com.alamin.pos.dto.SaleRequest;
import com.alamin.pos.dto.SaleResponse;
import com.alamin.pos.entity.InventoryLot;
import com.alamin.pos.entity.Product;
import com.alamin.pos.entity.StockInventory;
import com.alamin.pos.service.SaleService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class SystemConcurrencyStressTest {

    @Autowired
    private SaleService saleService;

    @Autowired
    private com.alamin.pos.repository.ProductRepository productRepository;

    @Autowired
    private com.alamin.pos.repository.InventoryLotRepository inventoryLotRepository;

    @Autowired
    private com.alamin.pos.repository.StockInventoryRepository stockInventoryRepository;

    @Autowired
    private com.alamin.pos.repository.SaleRepository saleRepository;

    @Autowired
    private com.alamin.pos.repository.SaleItemRepository saleItemRepository;

    @Test
    @DisplayName("1. High Concurrency Checkout: 10 threads compete for 10 units each; all 10 atomically succeed, zero lost updates")
    void testConcurrentCheckoutStress() throws InterruptedException {
        String uniqueSuffix = UUID.randomUUID().toString().substring(0, 8);
        Product product = productRepository.save(Product.builder()
                .productCode("PROD-STRESS-" + uniqueSuffix)
                .nameEn("Stress Test Product " + uniqueSuffix)
                .nameBn("স্ট্রেস টেস্ট পণ্য")
                .category("INSECTICIDE")
                .baseUnit("Bottle")
                .cartonMultiplier(BigDecimal.ONE)
                .standardRetailPrice(new BigDecimal("300.00"))
                .standardWholesalePrice(new BigDecimal("280.00"))
                .build());

        // Dedicated lot with 50 units in DOKAN
        InventoryLot lot = inventoryLotRepository.save(InventoryLot.builder()
                .product(product)
                .lotNumber("LOT-STRESS-" + uniqueSuffix)
                .barcode("BAR-STRESS-" + uniqueSuffix)
                .entryDate(LocalDate.now())
                .expiryDate(LocalDate.now().plusYears(5))
                .purchaseCost(new BigDecimal("200.00"))
                .lotRetailPrice(new BigDecimal("300.00"))
                .lotWholesalePrice(new BigDecimal("280.00"))
                .build());

        stockInventoryRepository.save(StockInventory.builder()
                .lot(lot)
                .location("DOKAN")
                .quantity(new BigDecimal("50.000"))
                .build());

        int threadCount = 10;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch startSignal = new CountDownLatch(1);
        CountDownLatch doneSignal = new CountDownLatch(threadCount);

        AtomicInteger successCount = new AtomicInteger(0);
        List<SaleResponse> completedSales = new CopyOnWriteArrayList<>();

        try {
            for (int i = 0; i < threadCount; i++) {
                final int laneId = i + 1;
                executor.submit(() -> {
                    try {
                        startSignal.await(); // Synchronize thread release

                        SaleItemRequest item = SaleItemRequest.builder()
                                .lotId(lot.getId())
                                .totalQuantity(new BigDecimal("10.000"))
                                .unitPrice(new BigDecimal("300.00"))
                                .build();

                        SaleRequest request = SaleRequest.builder()
                                .saleMode("WHOLESALE")
                                .items(List.of(item))
                                .paymentMethod("CASH")
                                .cashPaid(new BigDecimal("3000.00"))
                                .cashTendered(new BigDecimal("3000.00"))
                                .cashierName("Lane-" + laneId)
                                .build();

                        SaleResponse response = saleService.processSale(request);
                        completedSales.add(response);
                        successCount.incrementAndGet();
                    } catch (Exception ex) {
                        ex.printStackTrace();
                    } finally {
                        doneSignal.countDown();
                    }
                });
            }

            startSignal.countDown(); // FIRE ALL 10 THREADS SIMULTANEOUSLY
            boolean finished = doneSignal.await(15, TimeUnit.SECONDS);
            executor.shutdown();

            assertThat(finished).isTrue();
            assertThat(successCount.get()).isEqualTo(10);

            // Verify ending stock is exactly -50.000 (50 - 10 * 10) - zero lost updates
            StockInventory endingStock = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "DOKAN")
                    .orElseThrow();
            assertThat(endingStock.getQuantity()).isEqualByComparingTo("-50.000");

            // Verify all 10 successful invoices have unique sequential document numbers
            List<String> invoiceNumbers = completedSales.stream().map(SaleResponse::getInvoiceNo).distinct().toList();
            assertThat(invoiceNumbers).hasSize(10);
        } finally {
            for (SaleResponse s : completedSales) {
                saleItemRepository.deleteAll(saleItemRepository.findBySaleId(s.getId()));
                saleRepository.deleteById(s.getId());
            }
            stockInventoryRepository.deleteAll(stockInventoryRepository.findByLotId(lot.getId()));
            inventoryLotRepository.deleteById(lot.getId());
            productRepository.deleteById(product.getId());
        }
    }
}
