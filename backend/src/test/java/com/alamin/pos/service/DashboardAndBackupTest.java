package com.alamin.pos.service;

import com.alamin.pos.controller.BackupController;
import com.alamin.pos.controller.DashboardController;
import com.alamin.pos.dto.CustomerPaymentRequest;
import com.alamin.pos.dto.DashboardSummaryDto;
import com.alamin.pos.dto.ExpiringLotDto;
import com.alamin.pos.dto.LowStockProductDto;
import com.alamin.pos.dto.SaleItemRequest;
import com.alamin.pos.dto.SaleRequest;
import com.alamin.pos.dto.SaleReturnItemRequest;
import com.alamin.pos.dto.SaleReturnRequest;
import com.alamin.pos.entity.Customer;
import com.alamin.pos.entity.InventoryLot;
import com.alamin.pos.entity.Product;
import com.alamin.pos.entity.StockInventory;
import com.alamin.pos.repository.CustomerRepository;
import com.alamin.pos.repository.InventoryLotRepository;
import com.alamin.pos.repository.ProductRepository;
import com.alamin.pos.repository.StockInventoryRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.springframework.security.test.context.support.WithMockUser;

@SpringBootTest
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER")
@Transactional
class DashboardAndBackupTest {

    @Autowired
    private DashboardService dashboardService;

    @Autowired
    private BackupService backupService;

    @Autowired
    private SaleService saleService;

    @Autowired
    private CustomerService customerService;

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
    private MockMvc mockMvc;

    @Test
    @DisplayName("1. Dashboard Summary Metrics: Verify summary returns valid totals, non-null cash in drawer, market due, and customer count")
    void testDashboardSummaryMetrics() throws Exception {
        DashboardSummaryDto summary = dashboardService.getSummary();

        assertThat(summary).isNotNull();
        assertThat(summary.getTotalSalesToday()).isNotNull();
        assertThat(summary.getTotalSalesMonth()).isNotNull();
        assertThat(summary.getGrossProfitToday()).isNotNull();
        assertThat(summary.getGrossProfitMonth()).isNotNull();
        assertThat(summary.getCashInDrawerToday()).isNotNull();
        assertThat(summary.getTotalMarketDue()).isNotNull();
        assertThat(summary.getTotalMarketDue()).isEqualByComparingTo("15000.00");
        assertThat(summary.getTotalCustomers()).isGreaterThanOrEqualTo(2);
        assertThat(summary.getExpiringLots()).isNotNull();
        assertThat(summary.getLowStockProducts()).isNotNull();

        // Verify REST controller GET /api/dashboard/summary
        mockMvc.perform(get("/api/dashboard/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalMarketDue").value(15000.00))
                .andExpect(jsonPath("$.totalCustomers").isNumber())
                .andExpect(jsonPath("$.cashInDrawerToday").isNumber());
    }

    @Test
    @DisplayName("2. Gross Profit Accuracy: Process test sale with known unit price and frozen unit cost; verify grossProfitToday matches exact mathematical calculation")
    void testGrossProfitAccuracy() {
        DashboardSummaryDto baseline = dashboardService.getSummary();
        BigDecimal baselineProfit = baseline.getGrossProfitToday();
        BigDecimal baselineSales = baseline.getTotalSalesToday();

        Customer customer = customerRepository.findByPhone("01711000001").orElseThrow();
        InventoryLot lot = inventoryLotRepository.findByBarcode("SYN-AMI-202502").orElseThrow();
        // lot purchaseCost = 500.00

        // 2 bottles @ 650.00 = 1300.00 subtotal, discount = 50.00 -> totalAmount = 1250.00
        // Expected line profit: 2 * (650.00 - 500.00) = 300.00
        // Expected gross profit after discount: 300.00 - 50.00 = 250.00
        SaleItemRequest itemReq = SaleItemRequest.builder()
                .lotId(lot.getId())
                .totalQuantity(new BigDecimal("2.000"))
                .dokanQuantity(new BigDecimal("2.000"))
                .godownQuantity(BigDecimal.ZERO)
                .unitPrice(new BigDecimal("650.00"))
                .build();

        SaleRequest saleReq = SaleRequest.builder()
                .customerId(customer.getId())
                .saleMode("RETAIL")
                .discount(new BigDecimal("50.00"))
                .roundOff(BigDecimal.ZERO)
                .cashPaid(new BigDecimal("1250.00"))
                .items(List.of(itemReq))
                .build();

        saleService.processSale(saleReq);

        DashboardSummaryDto updated = dashboardService.getSummary();

        // Exact mathematical assertions:
        assertThat(updated.getTotalSalesToday())
                .isEqualByComparingTo(baselineSales.add(new BigDecimal("1250.00")));
        assertThat(updated.getGrossProfitToday())
                .isEqualByComparingTo(baselineProfit.add(new BigDecimal("250.00")));
        assertThat(updated.getGrossProfitMonth())
                .isEqualByComparingTo(baseline.getGrossProfitMonth().add(new BigDecimal("250.00")));
    }

    @Test
    @DisplayName("3. Cash in Drawer Calculation: Test cash sale + repayment - cash refund; verify drawer matches exact net cash")
    void testCashInDrawerCalculation() {
        DashboardSummaryDto baseline = dashboardService.getSummary();
        BigDecimal baselineDrawer = baseline.getCashInDrawerToday();

        Customer customer = customerRepository.findByPhone("01711000001").orElseThrow();
        InventoryLot lot = inventoryLotRepository.findByBarcode("SYN-AMI-202502").orElseThrow();

        // 1. Cash Sale (+1000.00)
        SaleItemRequest itemReq = SaleItemRequest.builder()
                .lotId(lot.getId())
                .totalQuantity(new BigDecimal("2.000"))
                .dokanQuantity(new BigDecimal("2.000"))
                .godownQuantity(BigDecimal.ZERO)
                .unitPrice(new BigDecimal("500.00"))
                .build();

        SaleRequest saleReq = SaleRequest.builder()
                .customerId(customer.getId())
                .saleMode("RETAIL")
                .cashPaid(new BigDecimal("1000.00"))
                .items(List.of(itemReq))
                .build();
        saleService.processSale(saleReq);

        // 2. Customer Repayment (+500.00 cash)
        CustomerPaymentRequest payReq = CustomerPaymentRequest.builder()
                .amount(new BigDecimal("500.00"))
                .moneyReceiptNo("MR-DASH-901")
                .paymentMethod("CASH")
                .notes("Cash in drawer test repayment")
                .build();
        customerService.recordPayment(customer.getId(), payReq);

        // 3. Cash Refund (-350.00 cash)
        SaleReturnItemRequest returnItem = SaleReturnItemRequest.builder()
                .lotId(lot.getId())
                .quantity(new BigDecimal("1.000"))
                .refundPrice(new BigDecimal("350.00"))
                .isDamaged(false)
                .restockLocation("DOKAN")
                .build();

        SaleReturnRequest returnReq = SaleReturnRequest.builder()
                .refundType("CASH_REFUND")
                .reason("Cash in drawer test refund")
                .items(List.of(returnItem))
                .build();
        saleReturnService.processReturn(returnReq);

        // Net change: +1000.00 + 500.00 - 350.00 = +1150.00
        DashboardSummaryDto updated = dashboardService.getSummary();
        assertThat(updated.getCashInDrawerToday())
                .isEqualByComparingTo(baselineDrawer.add(new BigDecimal("1150.00")));
    }

    @Test
    @DisplayName("4. Expiry & Low Stock Alerts: Verify detection of lots expiring in < 30 days and products below min stock alert")
    void testExpiryAndLowStockAlerts() {
        // 1. Create a product with stock <= minStockAlert (5 units in stock, alert threshold is 10)
        Product lowStockProduct = productRepository.save(Product.builder()
                .productCode("SYN-TEST-LOW")
                .nameEn("Low Stock Test Fungicide")
                .nameBn("লো স্টক টেস্ট বালাইনাশক")
                .category("Fungicide")
                .baseUnit("Bottle")
                .standardRetailPrice(new BigDecimal("400.00"))
                .standardWholesalePrice(new BigDecimal("350.00"))
                .minStockAlert(10)
                .build());

        InventoryLot normalLot = inventoryLotRepository.save(InventoryLot.builder()
                .product(lowStockProduct)
                .lotNumber("LOT-LOW-01")
                .entryDate(LocalDate.now())
                .expiryDate(LocalDate.now().plusMonths(12)) // not expiring soon
                .purchaseCost(new BigDecimal("300.00"))
                .lotRetailPrice(new BigDecimal("400.00"))
                .lotWholesalePrice(new BigDecimal("350.00"))
                .barcode("SYN-LOW-LOT01")
                .build());

        stockInventoryRepository.save(StockInventory.builder()
                .lot(normalLot)
                .location("DOKAN")
                .quantity(new BigDecimal("5.000"))
                .build());

        // 2. Create an expiring lot (expiring in 15 days, which is <= 30 days)
        Product expiringProduct = productRepository.findByProductCode("SYN-AMI-TOP").orElseThrow();
        InventoryLot expiringLot = inventoryLotRepository.save(InventoryLot.builder()
                .product(expiringProduct)
                .lotNumber("LOT-EXP-15DAYS")
                .entryDate(LocalDate.now().minusMonths(6))
                .expiryDate(LocalDate.now().plusDays(15))
                .purchaseCost(new BigDecimal("510.00"))
                .lotRetailPrice(new BigDecimal("650.00"))
                .lotWholesalePrice(new BigDecimal("580.00"))
                .barcode("SYN-EXP-15DAYS")
                .build());

        stockInventoryRepository.save(StockInventory.builder()
                .lot(expiringLot)
                .location("DOKAN")
                .quantity(new BigDecimal("4.000"))
                .build());
        stockInventoryRepository.save(StockInventory.builder()
                .lot(expiringLot)
                .location("GODOWN")
                .quantity(new BigDecimal("8.000"))
                .build());

        DashboardSummaryDto summary = dashboardService.getSummary();

        // Low stock verification
        assertThat(summary.getLowStockCount()).isGreaterThanOrEqualTo(1);
        LowStockProductDto lowProductDto = summary.getLowStockProducts().stream()
                .filter(p -> p.getProductCode().equals("SYN-TEST-LOW"))
                .findFirst()
                .orElse(null);
        assertThat(lowProductDto).isNotNull();
        assertThat(lowProductDto.getMinStockAlert()).isEqualTo(10);
        assertThat(lowProductDto.getTotalStock()).isEqualByComparingTo("5.000");

        // Expiring lot verification
        assertThat(summary.getExpiringSoonCount()).isGreaterThanOrEqualTo(1);
        ExpiringLotDto expLotDto = summary.getExpiringLots().stream()
                .filter(l -> l.getLotNumber().equals("LOT-EXP-15DAYS"))
                .findFirst()
                .orElse(null);
        assertThat(expLotDto).isNotNull();
        assertThat(expLotDto.getProductCode()).isEqualTo("SYN-AMI-TOP");
        assertThat(expLotDto.getDaysUntilExpiry()).isEqualTo(15);
        assertThat(expLotDto.getDokanQuantity()).isEqualByComparingTo("4.000");
        assertThat(expLotDto.getGodownQuantity()).isEqualByComparingTo("8.000");
    }

    @Test
    @DisplayName("5. Database Backup SQL Export: Execute BackupService.exportSqlBackup(); verify non-empty byte array, SQL statements, and 200 OK via BackupController")
    void testDatabaseBackupSqlExport() throws Exception {
        byte[] backupBytes = backupService.exportSqlBackup();
        assertThat(backupBytes).isNotNull();
        assertThat(backupBytes.length).isGreaterThan(0);

        String sqlDump = new String(backupBytes, StandardCharsets.UTF_8);
        // Verify SQL DDL & DML statements
        assertThat(sqlDump).contains("CREATE ");
        assertThat(sqlDump).contains("INSERT INTO ");
        assertThat(sqlDump).contains("PRODUCT");

        String filename = backupService.getBackupFileName();
        assertThat(filename).matches("^syngenta-pos-backup-\\d{8}-\\d{6}\\.sql$");

        // Verify HTTP download via BackupController
        mockMvc.perform(get("/api/backup/download"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, org.hamcrest.Matchers.startsWith("attachment; filename=\"syngenta-pos-backup-")))
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, "application/sql"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content().string(org.hamcrest.Matchers.containsString("CREATE ")))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content().string(org.hamcrest.Matchers.containsString("INSERT INTO ")));
    }
}
