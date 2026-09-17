package com.alamin.pos.service;

import com.alamin.pos.dto.SaleItemRequest;
import com.alamin.pos.dto.SaleRequest;
import com.alamin.pos.dto.SaleResponse;
import com.alamin.pos.dto.SaleReturnItemRequest;
import com.alamin.pos.dto.SaleReturnRequest;
import com.alamin.pos.dto.SaleReturnResponse;
import com.alamin.pos.entity.Customer;
import com.alamin.pos.entity.InventoryLot;
import com.alamin.pos.entity.Product;
import com.alamin.pos.entity.StockInventory;
import com.alamin.pos.exception.ExpiredLotSaleException;
import com.alamin.pos.exception.InvalidReturnException;
import com.alamin.pos.repository.CustomerRepository;
import com.alamin.pos.repository.InventoryLotRepository;
import com.alamin.pos.repository.ProductRepository;
import com.alamin.pos.repository.StockInventoryRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Transactional
class AgrochemicalRegulatoryTest {

    @Autowired
    private SaleService saleService;

    @Autowired
    private SaleReturnService saleReturnService;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private InventoryLotRepository inventoryLotRepository;

    @Autowired
    private StockInventoryRepository stockInventoryRepository;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private InventoryService inventoryService;

    @Test
    @DisplayName("Verify selling expired pesticide lot is blocked with ExpiredLotSaleException")
    void testSellingExpiredLotBlocked() {
        Product product = productRepository.findByProductCode("SYN-AMI-TOP").orElseThrow();

        InventoryLot expiredLot = inventoryLotRepository.saveAndFlush(
                InventoryLot.builder()
                        .product(product)
                        .lotNumber("LOT-EXPIRED-TEST")
                        .entryDate(LocalDate.now().minusYears(2))
                        .expiryDate(LocalDate.now().minusDays(5)) // Expired 5 days ago
                        .purchaseCost(new BigDecimal("500.00"))
                        .lotRetailPrice(new BigDecimal("650.00"))
                        .lotWholesalePrice(new BigDecimal("580.00"))
                        .barcode("SYN-EXP-BAR-01")
                        .build()
        );

        stockInventoryRepository.saveAndFlush(
                StockInventory.builder()
                        .lot(expiredLot)
                        .location("DOKAN")
                        .quantity(new BigDecimal("10.000"))
                        .build()
        );

        SaleRequest request = SaleRequest.builder()
                .saleMode("RETAIL")
                .paymentMethod("CASH")
                .cashPaid(new BigDecimal("650.00"))
                .items(List.of(
                        SaleItemRequest.builder()
                                .lotId(expiredLot.getId())
                                .totalQuantity(new BigDecimal("1.000"))
                                .unitPrice(new BigDecimal("650.00"))
                                .build()
                ))
                .build();

        assertThatThrownBy(() -> saleService.processSale(request))
                .isInstanceOf(ExpiredLotSaleException.class)
                .hasMessageContaining("Cannot sell expired lot");
    }

    @Test
    @DisplayName("Verify invoice return cannot return items that were not on the original sale")
    void testReturnItemNotInOriginalSale() {
        Customer customer = customerRepository.findByPhone("01711000001").orElseThrow();
        InventoryLot lot1 = inventoryLotRepository.findByBarcode("SYN-AMI-202502").orElseThrow();
        InventoryLot lot2 = inventoryLotRepository.findByBarcode("SYN-VIR-202601").orElseThrow();

        // 1. Sale with lot1
        SaleResponse sale = saleService.processSale(SaleRequest.builder()
                .customerId(customer.getId())
                .saleMode("RETAIL")
                .paymentMethod("CASH")
                .cashPaid(new BigDecimal("1300.00"))
                .items(List.of(
                        SaleItemRequest.builder()
                                .lotId(lot1.getId())
                                .totalQuantity(new BigDecimal("2.000"))
                                .unitPrice(new BigDecimal("650.00"))
                                .build()
                ))
                .build());

        // 2. Return with lot2 (not in sale)
        SaleReturnRequest returnReq = SaleReturnRequest.builder()
                .originalSaleId(sale.getId())
                .customerId(customer.getId())
                .refundType("CASH_REFUND")
                .items(List.of(
                        SaleReturnItemRequest.builder()
                                .lotId(lot2.getId())
                                .quantity(new BigDecimal("1.000"))
                                .refundPrice(new BigDecimal("650.00"))
                                .build()
                ))
                .build();

        assertThatThrownBy(() -> saleReturnService.processReturn(returnReq))
                .isInstanceOf(InvalidReturnException.class)
                .hasMessageContaining("was not part of original invoice");
    }

    @Test
    @DisplayName("Verify invoice return cannot exceed purchased quantity")
    void testReturnExceedingPurchasedQuantity() {
        Customer customer = customerRepository.findByPhone("01711000001").orElseThrow();
        InventoryLot lot = inventoryLotRepository.findByBarcode("SYN-AMI-202502").orElseThrow();

        // Sale: 2 units
        SaleResponse sale = saleService.processSale(SaleRequest.builder()
                .customerId(customer.getId())
                .saleMode("RETAIL")
                .paymentMethod("CASH")
                .cashPaid(new BigDecimal("1300.00"))
                .items(List.of(
                        SaleItemRequest.builder()
                                .lotId(lot.getId())
                                .totalQuantity(new BigDecimal("2.000"))
                                .unitPrice(new BigDecimal("650.00"))
                                .build()
                ))
                .build());

        // Attempting to return 3 units
        SaleReturnRequest returnReq = SaleReturnRequest.builder()
                .originalSaleId(sale.getId())
                .customerId(customer.getId())
                .refundType("CASH_REFUND")
                .items(List.of(
                        SaleReturnItemRequest.builder()
                                .lotId(lot.getId())
                                .quantity(new BigDecimal("3.000"))
                                .refundPrice(new BigDecimal("650.00"))
                                .build()
                ))
                .build();

        assertThatThrownBy(() -> saleReturnService.processReturn(returnReq))
                .isInstanceOf(InvalidReturnException.class)
                .hasMessageContaining("exceeds remaining returnable quantity");
    }

    @Test
    @DisplayName("Verify damaged returns are routed to QUARANTINE stock with zero salable stock leakage")
    void testDamagedReturnStockQuarantined() {
        InventoryLot lot = inventoryLotRepository.findByBarcode("SYN-AMI-202502").orElseThrow();
        StockInventory initialDokanStock = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "DOKAN").orElseThrow();
        BigDecimal initialQty = initialDokanStock.getQuantity();

        BigDecimal salableQtyBefore = stockInventoryRepository.sumQuantityByProductId(lot.getProduct().getId());

        SaleReturnRequest returnReq = SaleReturnRequest.builder()
                .refundType("CASH_REFUND")
                .items(List.of(
                        SaleReturnItemRequest.builder()
                                .lotId(lot.getId())
                                .quantity(new BigDecimal("1.000"))
                                .refundPrice(new BigDecimal("650.00"))
                                .isDamaged(true)
                                .build()
                ))
                .build();

        SaleReturnResponse response = saleReturnService.processReturn(returnReq);
        assertThat(response).isNotNull();

        // 1. Salable Dokan stock must remain completely untouched
        StockInventory afterReturnStock = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "DOKAN").orElseThrow();
        assertThat(afterReturnStock.getQuantity()).as("Damaged return must not increment salable Dokan stock").isEqualByComparingTo(initialQty);

        // 2. Quarantine stock must exist with quantity 1.000
        StockInventory quarantineStock = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "QUARANTINE").orElseThrow();
        assertThat(quarantineStock.getQuantity()).isEqualByComparingTo("1.000");

        // 3. Salable product quantity must not have increased
        BigDecimal salableQtyAfter = stockInventoryRepository.sumQuantityByProductId(lot.getProduct().getId());
        assertThat(salableQtyAfter).isEqualByComparingTo(salableQtyBefore);

        // 4. Quarantine overview must include this lot
        List<com.alamin.pos.dto.QuarantineStockResponse> quarantineList = inventoryService.getQuarantineStockOverview();
        assertThat(quarantineList).anyMatch(q -> q.getLotId().equals(lot.getId()) && q.getQuarantineQuantity().compareTo(new BigDecimal("1.000")) == 0);
    }
}
