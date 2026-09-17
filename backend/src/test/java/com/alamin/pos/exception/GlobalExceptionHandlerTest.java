package com.alamin.pos.exception;

import com.alamin.pos.dto.CustomerRequest;
import com.alamin.pos.dto.LotEntryRequest;
import com.alamin.pos.dto.QuarantineDisposalRequest;
import com.alamin.pos.dto.SaleRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collections;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import org.springframework.security.test.context.support.WithMockUser;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@WithMockUser(roles = "CASHIER")
public class GlobalExceptionHandlerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @DisplayName("1. ResourceNotFoundException returns HTTP 404 and RESOURCE_NOT_FOUND error code")
    void testResourceNotFoundException() throws Exception {
        mockMvc.perform(get("/api/customers/9999999")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"))
                .andExpect(jsonPath("$.message", containsString("Customer not found with id: 9999999")))
                .andExpect(jsonPath("$.path").value("/api/customers/9999999"))
                .andExpect(jsonPath("$.timestamp").isNotEmpty());
    }

    @Test
    @WithMockUser(roles = "OWNER")
    @DisplayName("2. InsufficientStockException returns HTTP 422 and INSUFFICIENT_STOCK error code")
    void testInsufficientStockException() throws Exception {
        QuarantineDisposalRequest request = QuarantineDisposalRequest.builder()
                .lotId(1L)
                .quantity(new BigDecimal("999999.000"))
                .disposalType("WRITE_OFF")
                .build();

        mockMvc.perform(post("/api/inventory/quarantine/dispose")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.status").value(422))
                .andExpect(jsonPath("$.errorCode").value("INSUFFICIENT_STOCK"))
                .andExpect(jsonPath("$.path").value("/api/inventory/quarantine/dispose"))
                .andExpect(jsonPath("$.timestamp").isNotEmpty());
    }

    @Test
    @DisplayName("3. DuplicateResourceException returns HTTP 409 and DUPLICATE_RESOURCE error code")
    void testDuplicateResourceException() throws Exception {
        // Customer with phone 01711000001 already seeded in V2
        CustomerRequest request = new CustomerRequest();
        request.setName("Duplicate Dealer");
        request.setPhone("01711000001");

        mockMvc.perform(post("/api/customers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.errorCode").value("DUPLICATE_RESOURCE"))
                .andExpect(jsonPath("$.message", containsString("Customer with phone 01711000001 already exists")))
                .andExpect(jsonPath("$.path").value("/api/customers"))
                .andExpect(jsonPath("$.timestamp").isNotEmpty());
    }

    @Test
    @DisplayName("4. ValidationException returns HTTP 400 and VALIDATION_FAILED error code")
    void testValidationException() throws Exception {
        LotEntryRequest request = LotEntryRequest.builder()
                .productId(1L)
                .lotNumber("LOT-INV-TEST")
                .entryDate(LocalDate.now().minusMonths(1))
                .expiryDate(LocalDate.now().plusYears(1))
                .purchaseCost(new BigDecimal("100.00"))
                .lotRetailPrice(new BigDecimal("150.00"))
                .lotWholesalePrice(new BigDecimal("140.00"))
                .quantityCartons(new BigDecimal("-5.000"))
                .build();

        mockMvc.perform(post("/api/inventory/lots")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.path").value("/api/inventory/lots"))
                .andExpect(jsonPath("$.timestamp").isNotEmpty());
    }

    @Test
    @DisplayName("5. BusinessRuleViolationException returns HTTP 400 and BUSINESS_RULE_VIOLATION error code")
    void testBusinessRuleViolationException() throws Exception {
        com.alamin.pos.dto.SaleReturnItemRequest returnItem = com.alamin.pos.dto.SaleReturnItemRequest.builder()
                .lotId(1L)
                .quantity(new BigDecimal("1.000"))
                .refundPrice(new BigDecimal("650.00"))
                .isDamaged(false)
                .build();

        com.alamin.pos.dto.SaleReturnRequest request = com.alamin.pos.dto.SaleReturnRequest.builder()
                .customerId(null)
                .refundType("DUE_ADJUSTMENT")
                .items(java.util.List.of(returnItem))
                .build();

        mockMvc.perform(post("/api/returns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.errorCode").value("BUSINESS_RULE_VIOLATION"))
                .andExpect(jsonPath("$.message").value("Customer is required for DUE_ADJUSTMENT refund"))
                .andExpect(jsonPath("$.path").value("/api/returns"))
                .andExpect(jsonPath("$.timestamp").isNotEmpty());
    }

    @Test
    @DisplayName("6. MethodArgumentNotValidException returns HTTP 400 with field details")
    void testMethodArgumentNotValidException() throws Exception {
        CustomerRequest request = new CustomerRequest();
        request.setName(""); // Blank name
        request.setPhone("01999999999");

        mockMvc.perform(post("/api/customers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.details.name").value("Customer name is required"))
                .andExpect(jsonPath("$.path").value("/api/customers"))
                .andExpect(jsonPath("$.timestamp").isNotEmpty());
    }
}
