package com.alamin.pos.e2e;

import com.alamin.pos.dto.QuarantineDisposalRequest;
import com.alamin.pos.dto.SaleItemRequest;
import com.alamin.pos.dto.SaleRequest;
import com.alamin.pos.dto.SaleResponse;
import com.alamin.pos.entity.InventoryLot;
import com.alamin.pos.entity.Product;
import com.alamin.pos.entity.StockInventory;
import com.alamin.pos.repository.InventoryLotRepository;
import com.alamin.pos.repository.ProductRepository;
import com.alamin.pos.repository.StockInventoryRepository;
import com.alamin.pos.service.SaleService;
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
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
public class SecurityRegressionTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private SaleService saleService;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private InventoryLotRepository inventoryLotRepository;

    @Autowired
    private StockInventoryRepository stockInventoryRepository;

    @Test
    @DisplayName("Unauthenticated protected endpoints still require login")
    void unauthenticatedProtectedEndpointsDenied() throws Exception {
        mockMvc.perform(get("/api/dashboard/summary"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value("UNAUTHORIZED"));

        mockMvc.perform(get("/api/backup/download"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value("UNAUTHORIZED"));
    }

    @Test
    @WithMockUser
    @DisplayName("Authenticated inventory stock includes purchase cost")
    void authenticatedStockCostVisible() throws Exception {
        mockMvc.perform(get("/api/inventory/stock"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", not(empty())))
                .andExpect(jsonPath("$[0].purchaseCost").value(notNullValue()));
    }

    @Test
    @WithMockUser
    @DisplayName("Authenticated sale response includes cost and profit")
    void authenticatedSaleProfitVisible() throws Exception {
        InventoryLot lot = createLotWithStock("DOKAN", "20.000");

        SaleItemRequest item = SaleItemRequest.builder()
                .lotId(lot.getId())
                .totalQuantity(new BigDecimal("1.000"))
                .unitPrice(new BigDecimal("300.00"))
                .build();

        SaleRequest saleRequest = SaleRequest.builder()
                .saleMode("RETAIL")
                .items(List.of(item))
                .paymentMethod("CASH")
                .cashPaid(new BigDecimal("300.00"))
                .cashTendered(new BigDecimal("300.00"))
                .build();

        SaleResponse sale = saleService.processSale(saleRequest);

        mockMvc.perform(get("/api/sales/" + sale.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(sale.getId()))
                .andExpect(jsonPath("$.totalProfit").value(closeTo(100.00, 0.01)))
                .andExpect(jsonPath("$.items[0].unitCost").value(closeTo(200.00, 0.01)))
                .andExpect(jsonPath("$.items[0].lineProfit").value(closeTo(100.00, 0.01)));
    }

    @Test
    @WithMockUser
    @DisplayName("Authenticated quarantine view includes cost and loss value")
    void authenticatedQuarantineCostVisible() throws Exception {
        InventoryLot lot = createLotWithStock("QUARANTINE", "5.000");

        mockMvc.perform(get("/api/inventory/quarantine"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", not(empty())))
                .andExpect(jsonPath("$[?(@.lotId == " + lot.getId() + ")].purchaseCost").value(contains(closeTo(200.00, 0.01))))
                .andExpect(jsonPath("$[?(@.lotId == " + lot.getId() + ")].totalLossValue").value(contains(closeTo(1000.00, 0.01))));
    }

    @Test
    @WithMockUser
    @DisplayName("Authenticated quarantine disposal succeeds")
    void authenticatedUserCanDisposeQuarantineStock() throws Exception {
        InventoryLot lot = createLotWithStock("QUARANTINE", "10.000");

        QuarantineDisposalRequest request = QuarantineDisposalRequest.builder()
                .lotId(lot.getId())
                .quantity(new BigDecimal("4.000"))
                .disposalType("SUPPLIER_CLAIM")
                .remarks("Claim sent to distributor")
                .build();

        mockMvc.perform(post("/api/inventory/quarantine/dispose")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Quarantine stock disposed successfully"));

        StockInventory remainingQuarantine = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "QUARANTINE").orElseThrow();
        assertThat(remainingQuarantine.getQuantity()).isEqualByComparingTo("6.000");
    }

    private InventoryLot createLotWithStock(String location, String quantity) {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Product product = productRepository.save(Product.builder()
                .productCode("PROD-SEC-" + suffix)
                .nameEn("Access Test Product " + suffix)
                .nameBn("অ্যাক্সেস টেস্ট পণ্য")
                .category("INSECTICIDE")
                .baseUnit("Bottle")
                .cartonMultiplier(BigDecimal.ONE)
                .standardRetailPrice(new BigDecimal("300.00"))
                .standardWholesalePrice(new BigDecimal("280.00"))
                .build());

        InventoryLot lot = inventoryLotRepository.save(InventoryLot.builder()
                .product(product)
                .lotNumber("LOT-SEC-" + suffix)
                .barcode("BAR-SEC-" + suffix)
                .entryDate(LocalDate.now())
                .expiryDate(LocalDate.now().plusYears(5))
                .purchaseCost(new BigDecimal("200.00"))
                .lotRetailPrice(new BigDecimal("300.00"))
                .lotWholesalePrice(new BigDecimal("280.00"))
                .build());

        stockInventoryRepository.save(StockInventory.builder()
                .lot(lot)
                .location(location)
                .quantity(new BigDecimal(quantity))
                .build());

        return lot;
    }
}
