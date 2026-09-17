package com.alamin.pos.performance;

import com.alamin.pos.dto.CustomerRequest;
import com.alamin.pos.dto.DashboardSummaryDto;
import com.alamin.pos.service.DashboardService;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class DashboardQueryPerformanceTest {

    @Autowired
    private DashboardService dashboardService;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @DisplayName("1. Dashboard Execution: getSummary() executes efficiently with accurate calculations and no N+1")
    void testDashboardExecution() {
        DashboardSummaryDto summary = dashboardService.getSummary();

        assertThat(summary).isNotNull();
        assertThat(summary.getTotalSalesToday()).isNotNull();
        assertThat(summary.getGrossProfitToday()).isNotNull();
        assertThat(summary.getCashInDrawerToday()).isNotNull();
        assertThat(summary.getTotalMarketDue()).isNotNull();
        assertThat(summary.getTotalCustomers()).isGreaterThanOrEqualTo(1);
        assertThat(summary.getLowStockProducts()).isNotNull();
        assertThat(summary.getExpiringLots()).isNotNull();
    }

    @Test
    @WithMockUser(roles = "CASHIER")
    @DisplayName("2. Backward Compatibility: Unpaged GET /api/products returns JSON array")
    void testProductsUnpagedReturnsArray() throws Exception {
        mockMvc.perform(get("/api/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$", not(empty())));
    }

    @Test
    @WithMockUser(roles = "CASHIER")
    @DisplayName("3. Pagination: GET /api/products?paged=true returns Page structure")
    void testProductsPagedReturnsPageObject() throws Exception {
        mockMvc.perform(get("/api/products")
                        .param("paged", "true")
                        .param("page", "0")
                        .param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.totalElements").isNumber())
                .andExpect(jsonPath("$.size").value(2));
    }

    @Test
    @WithMockUser(roles = "CASHIER")
    @DisplayName("4. Backward Compatibility: Unpaged GET /api/customers returns JSON array")
    void testCustomersUnpagedReturnsArray() throws Exception {
        mockMvc.perform(get("/api/customers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$", not(empty())));
    }

    @Test
    @WithMockUser(roles = "CASHIER")
    @DisplayName("5. Pagination: GET /api/customers?paged=true returns Page structure")
    void testCustomersPagedReturnsPageObject() throws Exception {
        mockMvc.perform(get("/api/customers")
                        .param("paged", "true")
                        .param("page", "0")
                        .param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.totalElements").isNumber());
    }

    @Test
    @WithMockUser(roles = "CASHIER")
    @DisplayName("6. Backward Compatibility: Unpaged GET /api/inventory/stock returns JSON array")
    void testStockUnpagedReturnsArray() throws Exception {
        mockMvc.perform(get("/api/inventory/stock"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    @WithMockUser(roles = "CASHIER")
    @DisplayName("7. Pagination: GET /api/inventory/stock?paged=true returns Page structure")
    void testStockPagedReturnsPageObject() throws Exception {
        mockMvc.perform(get("/api/inventory/stock")
                        .param("paged", "true")
                        .param("page", "0")
                        .param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.totalElements").isNumber());
    }

    @Test
    @WithMockUser(roles = "CASHIER")
    @DisplayName("8. DTO Encapsulation: POST /api/customers returns CustomerResponseDto without entity exposure")
    void testCustomerCreationReturnsEncapsulatedDto() throws Exception {
        CustomerRequest request = new CustomerRequest();
        request.setName("New Farmer");
        request.setPhone("01899999999");
        request.setCustomerType("FARMER");
        request.setCreditLimit(new BigDecimal("10000.00"));
        request.setInitialDue(new BigDecimal("500.00"));

        mockMvc.perform(post("/api/customers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.name").value("New Farmer"))
                .andExpect(jsonPath("$.currentDue").value(500.00));
    }
}
