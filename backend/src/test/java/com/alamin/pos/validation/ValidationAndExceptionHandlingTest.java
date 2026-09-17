package com.alamin.pos.validation;

import com.alamin.pos.dto.CustomerRequest;
import com.alamin.pos.dto.ProductDto;
import com.alamin.pos.dto.SaleItemRequest;
import com.alamin.pos.dto.SaleRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ValidationAndExceptionHandlingTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @WithMockUser(roles = "OWNER")
    @DisplayName("1. Blank Product fields return HTTP 400 with structured field validation errors")
    void testBlankProductValidationErrors() throws Exception {
        ProductDto invalidProduct = ProductDto.builder()
                .productCode("") // Blank
                .nameEn("") // Blank
                .nameBn("") // Blank
                .standardRetailPrice(null) // Null
                .build();

        mockMvc.perform(post("/api/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidProduct)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.details.productCode").isNotEmpty())
                .andExpect(jsonPath("$.details.nameEn").isNotEmpty())
                .andExpect(jsonPath("$.details.nameBn").isNotEmpty())
                .andExpect(jsonPath("$.details.standardRetailPrice").isNotEmpty());
    }

    @Test
    @WithMockUser(roles = "CASHIER")
    @DisplayName("2. Invalid Bangladesh phone number returns HTTP 400 with details.phone error")
    void testInvalidCustomerPhoneValidation() throws Exception {
        CustomerRequest invalidCustomer = CustomerRequest.builder()
                .name("Test Farmer")
                .phone("12345") // Invalid non-BD phone number
                .build();

        mockMvc.perform(post("/api/customers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidCustomer)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.details.phone", containsString("Invalid Bangladesh phone number")));
    }

    @Test
    @WithMockUser(roles = "CASHIER")
    @DisplayName("3. Empty Sale Items list returns HTTP 400 Bad Request")
    void testEmptySaleItemsRejected() throws Exception {
        SaleRequest invalidSale = SaleRequest.builder()
                .saleMode("RETAIL")
                .items(List.of()) // Empty cart
                .build();

        mockMvc.perform(post("/api/sales")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidSale)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.details.items").isNotEmpty());
    }

    @Test
    @WithMockUser(roles = "CASHIER")
    @DisplayName("4. Zero or Negative Quantity in SaleItemRequest returns HTTP 400 Bad Request")
    void testZeroQuantityInSaleItemRejected() throws Exception {
        SaleItemRequest item = SaleItemRequest.builder()
                .lotId(1L)
                .totalQuantity(new BigDecimal("0.000")) // Invalid zero quantity
                .unitPrice(new BigDecimal("100.00"))
                .build();

        SaleRequest sale = SaleRequest.builder()
                .saleMode("RETAIL")
                .items(List.of(item))
                .build();

        mockMvc.perform(post("/api/sales")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(sale)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.details['items[0].totalQuantity']").isNotEmpty());
    }
}
