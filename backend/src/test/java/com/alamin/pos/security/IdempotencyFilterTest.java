package com.alamin.pos.security;

import com.alamin.pos.dto.SaleItemRequest;
import com.alamin.pos.dto.SaleRequest;
import com.alamin.pos.entity.InventoryLot;
import com.alamin.pos.entity.StockInventory;
import com.alamin.pos.repository.IdempotencyRecordRepository;
import com.alamin.pos.repository.InventoryLotRepository;
import com.alamin.pos.repository.StockInventoryRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class IdempotencyFilterTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private StockInventoryRepository stockInventoryRepository;

    @Autowired
    private InventoryLotRepository inventoryLotRepository;

    @Autowired
    private IdempotencyRecordRepository idempotencyRecordRepository;

    @Autowired
    private com.alamin.pos.repository.ProductRepository productRepository;

    @Test
    @WithMockUser(roles = "CASHIER")
    @DisplayName("1. Idempotency: Duplicate checkout with identical key deducts stock once and replays response")
    void testIdempotentSaleCheckout() throws Exception {
        com.alamin.pos.entity.Product product = productRepository.findByProductCode("SYN-AMI-TOP").orElseThrow();
        InventoryLot lot = inventoryLotRepository.save(InventoryLot.builder()
                .product(product)
                .lotNumber("LOT-IDEM-" + UUID.randomUUID().toString().substring(0, 8))
                .barcode("BAR-IDEM-" + UUID.randomUUID().toString().substring(0, 8))
                .entryDate(java.time.LocalDate.now())
                .expiryDate(java.time.LocalDate.now().plusYears(1))
                .purchaseCost(new BigDecimal("100.00"))
                .lotRetailPrice(new BigDecimal("150.00"))
                .lotWholesalePrice(new BigDecimal("140.00"))
                .build());

        StockInventory stockBefore = stockInventoryRepository.save(StockInventory.builder()
                .lot(lot)
                .location("DOKAN")
                .quantity(new BigDecimal("20.000"))
                .build());
        BigDecimal initialQty = stockBefore.getQuantity();

        String idempotencyKey = "IDEM-" + UUID.randomUUID();

        SaleItemRequest item = SaleItemRequest.builder()
                .lotId(lot.getId())
                .totalQuantity(new BigDecimal("2.000"))
                .dokanQuantity(new BigDecimal("2.000"))
                .godownQuantity(BigDecimal.ZERO)
                .unitPrice(new BigDecimal("150.00"))
                .build();

        SaleRequest sale = SaleRequest.builder()
                .saleMode("RETAIL")
                .items(List.of(item))
                .paymentMethod("CASH")
                .cashPaid(new BigDecimal("300.00"))
                .cashTendered(new BigDecimal("300.00"))
                .build();

        String jsonPayload = objectMapper.writeValueAsString(sale);

        // First attempt -> processes sale, creates invoice, records completed idempotency key
        MvcResult firstResult = mockMvc.perform(post("/api/sales")
                        .header("X-Idempotency-Key", idempotencyKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonPayload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.invoiceNo").isNotEmpty())
                .andReturn();

        JsonNode firstResponse = objectMapper.readTree(firstResult.getResponse().getContentAsString());
        String invoiceNo1 = firstResponse.get("invoiceNo").asText();

        // Verify stock deducted by 2.000 units
        StockInventory stockAfterFirst = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "DOKAN")
                .orElseThrow();
        assertThat(stockAfterFirst.getQuantity()).isEqualByComparingTo(initialQty.subtract(new BigDecimal("2.000")));

        // Second attempt with SAME idempotency key (e.g. network retry or cashier double-click)
        MvcResult secondResult = mockMvc.perform(post("/api/sales")
                        .header("X-Idempotency-Key", idempotencyKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonPayload))
                .andExpect(status().isCreated())
                .andExpect(header().string("X-Idempotency-Replayed", "true"))
                .andReturn();

        JsonNode secondResponse = objectMapper.readTree(secondResult.getResponse().getContentAsString());
        String invoiceNo2 = secondResponse.get("invoiceNo").asText();

        // Must return identical invoice
        assertThat(invoiceNo2).isEqualTo(invoiceNo1);

        // CRITICAL CHECK: Stock must NOT have been deducted a second time!
        StockInventory stockAfterSecond = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "DOKAN")
                .orElseThrow();
        assertThat(stockAfterSecond.getQuantity())
                .isEqualByComparingTo(initialQty.subtract(new BigDecimal("2.000")));

        // Cleanup test idempotency key
        idempotencyRecordRepository.deleteById(idempotencyKey);
    }

    @Test
    @WithMockUser(roles = "CASHIER")
    @DisplayName("2. Idempotency: In-progress concurrent request with identical key returns 409 Conflict")
    void testInProgressConflict() throws Exception {
        String inProgressKey = "IDEM-INPROG-" + UUID.randomUUID();

        // Seed an IN_PROGRESS record
        com.alamin.pos.entity.IdempotencyRecord record = com.alamin.pos.entity.IdempotencyRecord.builder()
                .id(inProgressKey)
                .status("IN_PROGRESS")
                .createdAt(java.time.LocalDateTime.now())
                .build();
        idempotencyRecordRepository.save(record);

        mockMvc.perform(post("/api/sales")
                        .header("X-Idempotency-Key", inProgressKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value("IDEMPOTENCY_CONFLICT"));

        idempotencyRecordRepository.deleteById(inProgressKey);
    }

    @Test
    @WithMockUser(roles = "CASHIER")
    @DisplayName("3. Idempotency: Failed validation request frees the key for retry")
    void testFailedValidationFreesKey() throws Exception {
        String failedKey = "IDEM-FAIL-" + UUID.randomUUID();

        // Invalid request (empty cart)
        mockMvc.perform(post("/api/sales")
                        .header("X-Idempotency-Key", failedKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"saleMode\":\"RETAIL\",\"items\":[]}"))
                .andExpect(status().isBadRequest());

        // Key should have been purged so client can fix and retry
        assertThat(idempotencyRecordRepository.findById(failedKey)).isEmpty();
    }
}

