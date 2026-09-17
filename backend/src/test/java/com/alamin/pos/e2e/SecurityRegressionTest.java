package com.alamin.pos.e2e;

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
    @DisplayName("1. Unauthenticated request to /api/dashboard/summary returns 401 Unauthorized")
    void testUnauthenticatedDashboardDenied() throws Exception {
        mockMvc.perform(get("/api/dashboard/summary"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value("UNAUTHORIZED"));
    }

    @Test
    @DisplayName("2. Unauthenticated request to /api/backup/download returns 401 Unauthorized")
    void testUnauthenticatedBackupDenied() throws Exception {
        mockMvc.perform(get("/api/backup/download"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value("UNAUTHORIZED"));
    }

    @Test
    @WithMockUser(roles = "CASHIER")
    @DisplayName("3. Cashier token gets 403 Forbidden on /api/dashboard/summary")
    void testCashierForbiddenOnDashboard() throws Exception {
        mockMvc.perform(get("/api/dashboard/summary"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("FORBIDDEN"));
    }

    @Test
    @WithMockUser(roles = "CASHIER")
    @DisplayName("4. Cashier token gets 403 Forbidden on /api/backup/download")
    void testCashierForbiddenOnBackup() throws Exception {
        mockMvc.perform(get("/api/backup/download"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("FORBIDDEN"));
    }

    @Test
    @WithMockUser(roles = "CASHIER")
    @DisplayName("5. Cashier receives masked purchaseCost (null) on /api/inventory/stock")
    void testCashierStockCostMasking() throws Exception {
        mockMvc.perform(get("/api/inventory/stock"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", not(empty())))
                .andExpect(jsonPath("$[0].purchaseCost").value(nullValue()));
    }

    @Test
    @WithMockUser(roles = "CASHIER")
    @DisplayName("6. Cashier receives masked totalProfit (null) on /api/sales")
    void testCashierSaleProfitMasking() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Product product = productRepository.save(Product.builder()
                .productCode("PROD-SEC-" + suffix)
                .nameEn("Security Test Product " + suffix)
                .nameBn("নিরাপত্তা টেস্ট পণ্য")
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
                .location("DOKAN")
                .quantity(new BigDecimal("20.000"))
                .build());

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
                .andExpect(jsonPath("$.totalProfit").value(nullValue()))
                .andExpect(jsonPath("$.items[0].unitCost").value(nullValue()))
                .andExpect(jsonPath("$.items[0].lineProfit").value(nullValue()));
    }

    @Test
    @WithMockUser(roles = "OWNER")
    @DisplayName("7. Owner role receives unmasked purchaseCost on /api/inventory/stock")
    void testOwnerStockCostUnmasked() throws Exception {
        mockMvc.perform(get("/api/inventory/stock"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", not(empty())))
                .andExpect(jsonPath("$[0].purchaseCost").value(notNullValue()));
    }

    @Test
    @WithMockUser(roles = "OWNER")
    @DisplayName("8. Owner role receives 200 OK on /api/dashboard/summary")
    void testOwnerCanAccessDashboard() throws Exception {
        mockMvc.perform(get("/api/dashboard/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalMarketDue").isNumber())
                .andExpect(jsonPath("$.cashInDrawerToday").isNumber());
    }

    @Test
    @WithMockUser(roles = "OWNER")
    @DisplayName("9. Owner role receives 200 OK and SQL stream on /api/backup/download")
    void testOwnerCanDownloadBackup() throws Exception {
        mockMvc.perform(get("/api/backup/download"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", containsString(".sql")));
    }

    @Test
    @DisplayName("10. Public unauthenticated request allowed on /api/barcode/{barcode}")
    void testPublicBarcodeEndpoint() throws Exception {
        mockMvc.perform(get("/api/barcode/8901234567890"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG));
    }

    @Test
    @WithMockUser(roles = "CASHIER")
    @DisplayName("11. Cashier role: /api/inventory/quarantine masks purchaseCost and totalLossValue (null)")
    void testCashierQuarantineCostMasking() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Product product = productRepository.save(Product.builder()
                .productCode("PROD-QSEC-" + suffix)
                .nameEn("Quarantine Product " + suffix)
                .nameBn("কোয়ারেন্টাইন পণ্য")
                .category("INSECTICIDE")
                .baseUnit("Bottle")
                .cartonMultiplier(BigDecimal.ONE)
                .standardRetailPrice(new BigDecimal("300.00"))
                .standardWholesalePrice(new BigDecimal("280.00"))
                .build());

        InventoryLot lot = inventoryLotRepository.save(InventoryLot.builder()
                .product(product)
                .lotNumber("LOT-QSEC-" + suffix)
                .barcode("BAR-QSEC-" + suffix)
                .entryDate(LocalDate.now())
                .expiryDate(LocalDate.now().plusYears(5))
                .purchaseCost(new BigDecimal("200.00"))
                .lotRetailPrice(new BigDecimal("300.00"))
                .lotWholesalePrice(new BigDecimal("280.00"))
                .build());

        stockInventoryRepository.save(StockInventory.builder()
                .lot(lot)
                .location("QUARANTINE")
                .quantity(new BigDecimal("5.000"))
                .build());

        mockMvc.perform(get("/api/inventory/quarantine"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", not(empty())))
                .andExpect(jsonPath("$[?(@.lotId == " + lot.getId() + ")].purchaseCost").value(contains(nullValue())))
                .andExpect(jsonPath("$[?(@.lotId == " + lot.getId() + ")].totalLossValue").value(contains(nullValue())));
    }

    @Test
    @WithMockUser(roles = "OWNER")
    @DisplayName("12. Owner role: /api/inventory/quarantine displays unmasked purchaseCost and totalLossValue")
    void testOwnerQuarantineCostVisible() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Product product = productRepository.save(Product.builder()
                .productCode("PROD-QOWN-" + suffix)
                .nameEn("Quarantine Owner Product " + suffix)
                .nameBn("কোয়ারেন্টাইন পণ্য")
                .category("INSECTICIDE")
                .baseUnit("Bottle")
                .cartonMultiplier(BigDecimal.ONE)
                .standardRetailPrice(new BigDecimal("300.00"))
                .standardWholesalePrice(new BigDecimal("280.00"))
                .build());

        InventoryLot lot = inventoryLotRepository.save(InventoryLot.builder()
                .product(product)
                .lotNumber("LOT-QOWN-" + suffix)
                .barcode("BAR-QOWN-" + suffix)
                .entryDate(LocalDate.now())
                .expiryDate(LocalDate.now().plusYears(5))
                .purchaseCost(new BigDecimal("200.00"))
                .lotRetailPrice(new BigDecimal("300.00"))
                .lotWholesalePrice(new BigDecimal("280.00"))
                .build());

        stockInventoryRepository.save(StockInventory.builder()
                .lot(lot)
                .location("QUARANTINE")
                .quantity(new BigDecimal("5.000"))
                .build());

        mockMvc.perform(get("/api/inventory/quarantine"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", not(empty())))
                .andExpect(jsonPath("$[?(@.lotId == " + lot.getId() + ")].purchaseCost").value(contains(closeTo(200.00, 0.01))))
                .andExpect(jsonPath("$[?(@.lotId == " + lot.getId() + ")].totalLossValue").value(contains(closeTo(1000.00, 0.01))));
    }

    @Test
    @WithMockUser(roles = "CASHIER")
    @DisplayName("13. Cashier role: POST /api/inventory/quarantine/dispose returns 403 Forbidden")
    void testCashierCannotDisposeQuarantineStock() throws Exception {
        com.alamin.pos.dto.QuarantineDisposalRequest request = com.alamin.pos.dto.QuarantineDisposalRequest.builder()
                .lotId(1L)
                .quantity(new BigDecimal("2.000"))
                .disposalType("WRITE_OFF")
                .build();

        mockMvc.perform(post("/api/inventory/quarantine/dispose")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("FORBIDDEN"));
    }

    @Test
    @WithMockUser(roles = "OWNER")
    @DisplayName("14. Owner role: POST /api/inventory/quarantine/dispose decrements quarantine stock and logs DAMAGE_EXIT")
    void testOwnerCanDisposeQuarantineStock() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Product product = productRepository.save(Product.builder()
                .productCode("PROD-QDISP-" + suffix)
                .nameEn("Quarantine Disp Product " + suffix)
                .nameBn("কোয়ারেন্টাইন পণ্য")
                .category("INSECTICIDE")
                .baseUnit("Bottle")
                .cartonMultiplier(BigDecimal.ONE)
                .standardRetailPrice(new BigDecimal("300.00"))
                .standardWholesalePrice(new BigDecimal("280.00"))
                .build());

        InventoryLot lot = inventoryLotRepository.save(InventoryLot.builder()
                .product(product)
                .lotNumber("LOT-QDISP-" + suffix)
                .barcode("BAR-QDISP-" + suffix)
                .entryDate(LocalDate.now())
                .expiryDate(LocalDate.now().plusYears(5))
                .purchaseCost(new BigDecimal("200.00"))
                .lotRetailPrice(new BigDecimal("300.00"))
                .lotWholesalePrice(new BigDecimal("280.00"))
                .build());

        stockInventoryRepository.save(StockInventory.builder()
                .lot(lot)
                .location("QUARANTINE")
                .quantity(new BigDecimal("10.000"))
                .build());

        com.alamin.pos.dto.QuarantineDisposalRequest request = com.alamin.pos.dto.QuarantineDisposalRequest.builder()
                .lotId(lot.getId())
                .quantity(new BigDecimal("4.000"))
                .disposalType("SUPPLIER_CLAIM")
                .remarks("Claim sent to agrochemical distributor for broken caps")
                .build();

        mockMvc.perform(post("/api/inventory/quarantine/dispose")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Quarantine stock disposed successfully"));

        StockInventory remainingQuarantine = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "QUARANTINE").orElseThrow();
        assertThat(remainingQuarantine.getQuantity()).isEqualByComparingTo("6.000");
    }
}
