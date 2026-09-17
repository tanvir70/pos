package com.alamin.pos.service;

import com.alamin.pos.dto.SaleItemRequest;
import com.alamin.pos.dto.SaleRequest;
import com.alamin.pos.dto.SaleResponse;
import com.alamin.pos.entity.InventoryLot;
import com.alamin.pos.entity.StockInventory;
import com.alamin.pos.repository.InventoryLotRepository;
import com.alamin.pos.repository.StockInventoryRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class ConcurrencyLockingTest {

    @Autowired
    private DocumentSequenceService documentSequenceService;

    @Autowired
    private SaleService saleService;

    @Autowired
    private InventoryLotRepository inventoryLotRepository;

    @Autowired
    private StockInventoryRepository stockInventoryRepository;

    @Test
    @DisplayName("Verify DocumentSequenceService produces collision-free sequential numbers concurrently")
    void testConcurrentDocumentSequencing() throws InterruptedException {
        int threadCount = 20;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);

        List<String> invoiceNumbers = Collections.synchronizedList(new ArrayList<>());

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    startLatch.await();
                    String inv = documentSequenceService.generateInvoiceNumber();
                    invoiceNumbers.add(inv);
                } catch (InterruptedException ignored) {
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        startLatch.countDown();
        boolean completed = doneLatch.await(5, TimeUnit.SECONDS);
        executor.shutdown();

        assertThat(completed).isTrue();
        assertThat(invoiceNumbers).hasSize(threadCount);

        Set<String> uniqueNumbers = new HashSet<>(invoiceNumbers);
        assertThat(uniqueNumbers).as("All generated invoice numbers must be unique").hasSize(threadCount);

        for (String inv : invoiceNumbers) {
            assertThat(inv).matches("^INV-\\d{8}-\\d{6}$");
        }
    }

    @Autowired
    private com.alamin.pos.repository.ProductRepository productRepository;

    @Test
    @DisplayName("Verify concurrent checkouts serialize stock deductions without lost updates")
    void testConcurrentStockDeductions() throws Exception {
        // Create an isolated product and lot specifically for this concurrency test
        com.alamin.pos.entity.Product product = productRepository.saveAndFlush(
                com.alamin.pos.entity.Product.builder()
                        .productCode("SYN-CONC-TEST")
                        .nameEn("Concurrency Test Product")
                        .nameBn("কনকারেন্সি টেস্ট")
                        .category("Insecticide")
                        .baseUnit("Bottle")
                        .standardRetailPrice(new BigDecimal("650.00"))
                        .standardWholesalePrice(new BigDecimal("580.00"))
                        .build()
        );

        InventoryLot lot = inventoryLotRepository.saveAndFlush(
                InventoryLot.builder()
                        .product(product)
                        .lotNumber("LOT-CONC-99")
                        .entryDate(java.time.LocalDate.now())
                        .expiryDate(java.time.LocalDate.now().plusYears(1))
                        .purchaseCost(new BigDecimal("500.00"))
                        .lotRetailPrice(new BigDecimal("650.00"))
                        .lotWholesalePrice(new BigDecimal("580.00"))
                        .barcode("SYN-CONC-BAR-99")
                        .build()
        );

        BigDecimal startingQty = new BigDecimal("20.000");
        StockInventory initialDokanStock = stockInventoryRepository.saveAndFlush(
                StockInventory.builder()
                        .lot(lot)
                        .location("DOKAN")
                        .quantity(startingQty)
                        .build()
        );

        int concurrentSales = 5;
        BigDecimal sellQtyPerSale = new BigDecimal("2.000");

        ExecutorService executor = Executors.newFixedThreadPool(concurrentSales);
        CountDownLatch readyLatch = new CountDownLatch(concurrentSales);
        CountDownLatch startLatch = new CountDownLatch(1);

        List<Future<SaleResponse>> futures = new ArrayList<>();

        for (int i = 0; i < concurrentSales; i++) {
            futures.add(executor.submit(() -> {
                readyLatch.countDown();
                startLatch.await();

                SaleRequest req = SaleRequest.builder()
                        .saleMode("RETAIL")
                        .paymentMethod("CASH")
                        .cashPaid(new BigDecimal("1300.00"))
                        .items(List.of(
                                SaleItemRequest.builder()
                                        .lotId(lot.getId())
                                        .totalQuantity(sellQtyPerSale)
                                        .dokanQuantity(sellQtyPerSale)
                                        .godownQuantity(BigDecimal.ZERO)
                                        .unitPrice(new BigDecimal("650.00"))
                                        .build()
                        ))
                        .build();

                return saleService.processSale(req);
            }));
        }

        readyLatch.await();
        startLatch.countDown();

        int successfulSales = 0;
        for (Future<SaleResponse> future : futures) {
            SaleResponse resp = future.get(10, TimeUnit.SECONDS);
            if (resp != null && resp.getId() != null) {
                successfulSales++;
            }
        }
        executor.shutdown();

        assertThat(successfulSales).isEqualTo(concurrentSales);

        StockInventory updatedDokanStock = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "DOKAN")
                .orElseThrow();

        BigDecimal expectedQty = startingQty.subtract(sellQtyPerSale.multiply(BigDecimal.valueOf(concurrentSales)));
        assertThat(updatedDokanStock.getQuantity()).isEqualByComparingTo(expectedQty);
    }
}
