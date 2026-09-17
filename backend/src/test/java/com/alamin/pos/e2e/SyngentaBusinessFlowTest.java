package com.alamin.pos.e2e;

import com.alamin.pos.dto.CustomerPaymentRequest;
import com.alamin.pos.dto.DashboardSummaryDto;
import com.alamin.pos.dto.LotEntryRequest;
import com.alamin.pos.dto.SaleItemRequest;
import com.alamin.pos.dto.SaleRequest;
import com.alamin.pos.dto.SaleResponse;
import com.alamin.pos.dto.SaleReturnItemRequest;
import com.alamin.pos.dto.SaleReturnRequest;
import com.alamin.pos.dto.SaleReturnResponse;
import com.alamin.pos.entity.Customer;
import com.alamin.pos.entity.CustomerLedger;
import com.alamin.pos.entity.InventoryLot;
import com.alamin.pos.entity.Product;
import com.alamin.pos.entity.StockInventory;
import com.alamin.pos.repository.CustomerLedgerRepository;
import com.alamin.pos.repository.CustomerRepository;
import com.alamin.pos.repository.InventoryLotRepository;
import com.alamin.pos.repository.ProductRepository;
import com.alamin.pos.repository.StockInventoryRepository;
import com.alamin.pos.service.BackupService;
import com.alamin.pos.service.CustomerService;
import com.alamin.pos.service.DashboardService;
import com.alamin.pos.service.InventoryService;
import com.alamin.pos.service.SaleReturnService;
import com.alamin.pos.service.SaleService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

import org.springframework.test.annotation.DirtiesContext;

/**
 * End-to-End System Integration Test for Syngenta Agrochemical Dealership.
 * Verifies the full operational lifecycle:
 * 1. Shipment Arrival (Intake with carton multiplier conversion into DOKAN store stock)
 * 2. Wholesale Sale (Dokan store deduction, bargaining override, multi-channel split payment)
 * 3. Counter Retail Sale with Negative Stock (Dokan counter overdraw allowance)
 * 4. Direct Receipt-less Return (Restock to Dokan with customer due balance credit)
 * 5. Customer Debt Repayment (Cash collection with formal Money Receipt MR No.)
 * 6. Executive Dashboard Live Analytics (Cash in drawer, market due, sales totals)
 * 7. 1-Click Disaster Recovery SQL Backup (Native DDL/INSERT dump stream)
 */
@SpringBootTest
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class SyngentaBusinessFlowTest {

    private static final Logger log = LoggerFactory.getLogger(SyngentaBusinessFlowTest.class);

    @Autowired
    private InventoryService inventoryService;

    @Autowired
    private SaleService saleService;

    @Autowired
    private SaleReturnService saleReturnService;

    @Autowired
    private CustomerService customerService;

    @Autowired
    private DashboardService dashboardService;

    @Autowired
    private BackupService backupService;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private InventoryLotRepository inventoryLotRepository;

    @Autowired
    private StockInventoryRepository stockInventoryRepository;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private CustomerLedgerRepository customerLedgerRepository;

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @org.junit.jupiter.api.BeforeEach
    @org.junit.jupiter.api.AfterEach
    void cleanUpE2eTestData() {
        try {
            jdbcTemplate.execute("DELETE FROM sale_return_item WHERE lot_id IN (SELECT id FROM inventory_lot WHERE lot_number = 'LOT-E2E-AMI-01')");
            jdbcTemplate.execute("DELETE FROM sale_return WHERE reason LIKE '%unopened excess bottle%'");

            jdbcTemplate.execute("DELETE FROM sale_item WHERE lot_id IN (SELECT id FROM inventory_lot WHERE lot_number = 'LOT-E2E-AMI-01')");
            jdbcTemplate.execute("DELETE FROM sale WHERE cashier_name = 'Al-Amin' AND (sale_mode = 'WHOLESALE' OR sale_mode = 'RETAIL')");

            jdbcTemplate.execute("DELETE FROM stock_inventory WHERE lot_id IN (SELECT id FROM inventory_lot WHERE lot_number = 'LOT-E2E-AMI-01')");
            jdbcTemplate.execute("DELETE FROM inventory_lot WHERE lot_number = 'LOT-E2E-AMI-01'");

            jdbcTemplate.execute("DELETE FROM customer_ledger WHERE customer_id = (SELECT id FROM customer WHERE phone = '01711000001') AND (money_receipt_no = 'MR-E2E-999' OR notes LIKE '%INV-%' OR notes LIKE 'Return Credit%')");
            jdbcTemplate.execute("UPDATE customer SET current_due = 15000.00 WHERE phone = '01711000001'");
        } catch (Exception e) {
            log.warn("Cleanup warning: {}", e.getMessage());
        }
    }

    @Test
    @DisplayName("Complete Syngenta dealership business lifecycle flow: arrival -> wholesale -> negative stock -> return -> repayment -> analytics -> backup")
    void testCompleteSyngentaDealershipBusinessFlow() {

        DashboardSummaryDto baselineSummary = dashboardService.getSummary();
        BigDecimal baselineSales = baselineSummary.getTotalSalesToday() != null ? baselineSummary.getTotalSalesToday() : BigDecimal.ZERO;
        BigDecimal baselineProfit = baselineSummary.getGrossProfitToday() != null ? baselineSummary.getGrossProfitToday() : BigDecimal.ZERO;
        BigDecimal baselineCash = baselineSummary.getCashInDrawerToday() != null ? baselineSummary.getCashInDrawerToday() : BigDecimal.ZERO;

        // =========================================================================
        // Step 1: Shipment Arrival (Intake with carton conversion)
        // Record lot for Amistar Top (2 cartons = 40 bottles @ ৳500 purchase cost,
        // entry date today, challan CH-E2E-001).
        // Verify 40 bottles in DOKAN store stock.
        // =========================================================================
        log.info("--- Step 1: Shipment Arrival ---");
        Product amistar = productRepository.findByProductCode("SYN-AMI-TOP")
                .orElseThrow(() -> new IllegalStateException("Product SYN-AMI-TOP not found"));
        assertThat(amistar.getCartonMultiplier()).isEqualByComparingTo("20.000");

        LotEntryRequest lotEntryReq = LotEntryRequest.builder()
                .productId(amistar.getId())
                .lotNumber("LOT-E2E-AMI-01")
                .entryDate(LocalDate.now())
                .expiryDate(LocalDate.now().plusYears(2))
                .purchaseCost(new BigDecimal("500.00"))
                .lotRetailPrice(new BigDecimal("650.00"))
                .lotWholesalePrice(new BigDecimal("580.00"))
                .quantityCartons(new BigDecimal("2"))
                .quantityBaseUnits(BigDecimal.ZERO)
                .supplierName("Syngenta Bangladesh Ltd.")
                .challanNo("CH-E2E-001")
                .build();

        InventoryLot lot = inventoryService.recordLotEntry(lotEntryReq);

        assertThat(lot).isNotNull();
        assertThat(lot.getId()).isNotNull();
        assertThat(lot.getBarcode()).isEqualTo("SYN-AMI-TOP-LOT-E2E-AMI-01");

        // Verify exactly 40 base units (2 cartons * 20 multiplier) in DOKAN store stock
        StockInventory step1Dokan = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "DOKAN")
                .orElseThrow(() -> new AssertionError("Dokan stock missing for lot"));
        assertThat(step1Dokan.getQuantity()).isEqualByComparingTo("40.000");


        // =========================================================================
        // Step 2: Wholesale Sale (Store Deduction & Bargaining)
        // Sell 20 bottles with price override ৳575 (std ৳580),
        // discount ৳100, round-off ৳10, payment ৳5,000 cash + ৳3,000 bKash + remaining due.
        // Verify Dokan=20, customer due increased, gross profit exact.
        // =========================================================================
        log.info("--- Step 2: Wholesale Sale (Store Deduction & Bargaining) ---");
        Customer customer = customerRepository.findByPhone("01711000001")
                .orElseThrow(() -> new IllegalStateException("Seeded customer 01711000001 not found"));
        BigDecimal customerInitialDue = customer.getCurrentDue(); // 15,000.00 from seeds
        assertThat(customerInitialDue).isEqualByComparingTo("15000.00");

        SaleItemRequest wholesaleItem = SaleItemRequest.builder()
                .lotId(lot.getId())
                .totalQuantity(new BigDecimal("20.000"))
                .unitPrice(new BigDecimal("575.00")) // Bargained price override (standard is ৳580.00)
                .build();

        SaleRequest wholesaleSaleReq = SaleRequest.builder()
                .customerId(customer.getId())
                .saleMode("WHOLESALE")
                .items(List.of(wholesaleItem))
                .discount(new BigDecimal("100.00"))
                .roundOff(new BigDecimal("10.00"))
                .cashPaid(new BigDecimal("5000.00"))
                .digitalPaid(new BigDecimal("3000.00"))
                .digitalMedium("BKASH")
                .digitalTrxId("TRX-E2E-BKASH-01")
                .paymentMethod("SPLIT")
                .cashierName("Al-Amin")
                .build();

        SaleResponse wholesaleSaleResp = saleService.processSale(wholesaleSaleReq);

        assertThat(wholesaleSaleResp).isNotNull();
        assertThat(wholesaleSaleResp.getInvoiceNo()).startsWith("INV-");

        // Subtotal: 20 * 575 = ৳11,500.00
        assertThat(wholesaleSaleResp.getSubtotal()).isEqualByComparingTo("11500.00");
        // Total: 11,500 - 100 (discount) - 10 (round-off) = ৳11,390.00
        assertThat(wholesaleSaleResp.getTotalAmount()).isEqualByComparingTo("11390.00");
        // Paid: 5,000 + 3,000 = ৳8,000.00; Due: 11,390 - 8,000 = ৳3,390.00
        assertThat(wholesaleSaleResp.getDueAmount()).isEqualByComparingTo("3390.00");

        // Gross Profit: (575.00 unitPrice - 500.00 purchaseCost) * 20 - 100.00 discount - 10.00 round-off = ৳1,390.00
        assertThat(wholesaleSaleResp.getTotalProfit()).isEqualByComparingTo("1390.00");

        // Verify stock levels: Dokan drops from 40 to 20
        StockInventory step2Dokan = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "DOKAN").orElseThrow();
        assertThat(step2Dokan.getQuantity()).isEqualByComparingTo("20.000");

        // Verify customer due increased by ৳3,390.00 (from 15,000 to 18,390)
        Customer customerAfterWholesale = customerRepository.findById(customer.getId()).orElseThrow();
        assertThat(customerAfterWholesale.getCurrentDue()).isEqualByComparingTo("18390.00");


        // =========================================================================
        // Step 3: Counter Sale (Negative Stock)
        // Sell 23 bottles from Dokan (currently 20).
        // Verify Dokan becomes -3, sale succeeds.
        // =========================================================================
        log.info("--- Step 3: Counter Sale (Negative Stock) ---");
        SaleItemRequest retailItem = SaleItemRequest.builder()
                .lotId(lot.getId())
                .totalQuantity(new BigDecimal("23.000"))
                .unitPrice(new BigDecimal("650.00")) // Standard retail price
                .build();

        SaleRequest retailSaleReq = SaleRequest.builder()
                .saleMode("RETAIL")
                .items(List.of(retailItem))
                .cashPaid(new BigDecimal("14950.00")) // 23 * 650 = ৳14,950.00 in cash
                .paymentMethod("CASH")
                .cashierName("Al-Amin")
                .build();

        // BUSINESS DECISION: Allow Dokan counter stock to go negative to support ringing up newly arrived goods before supplier challan entry.
        SaleResponse retailSaleResp = saleService.processSale(retailSaleReq);

        assertThat(retailSaleResp).isNotNull();
        assertThat(retailSaleResp.getInvoiceNo()).startsWith("INV-");
        assertThat(retailSaleResp.getTotalAmount()).isEqualByComparingTo("14950.00");

        // Dokan stock drops from 20 to -3.000
        StockInventory step3Dokan = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "DOKAN").orElseThrow();
        assertThat(step3Dokan.getQuantity()).isEqualByComparingTo("-3.000");


        // =========================================================================
        // Step 4: Direct Return
        // Return 1 bottle to Dokan with due adjustment.
        // Verify Dokan becomes -2, customer due credited.
        // =========================================================================
        log.info("--- Step 4: Direct Return ---");
        SaleReturnItemRequest returnItem = SaleReturnItemRequest.builder()
                .lotId(lot.getId())
                .quantity(new BigDecimal("1.000"))
                .refundPrice(new BigDecimal("575.00")) // Credited at the wholesale bargained rate
                .isDamaged(false)
                .build();

        SaleReturnRequest returnReq = SaleReturnRequest.builder()
                .originalSaleId(null) // Direct receipt-less return
                .customerId(customer.getId())
                .refundType("DUE_ADJUSTMENT")
                .reason("Farmer returned 1 unopened excess bottle for credit adjustment")
                .items(List.of(returnItem))
                .build();

        // BUSINESS DECISION: Direct returns with DUE_ADJUSTMENT credit customer ledger with RETURN_CREDIT, reducing outstanding debt.
        SaleReturnResponse returnResp = saleReturnService.processReturn(returnReq);

        assertThat(returnResp).isNotNull();
        assertThat(returnResp.getReturnNo()).startsWith("RET-");
        assertThat(returnResp.getTotalRefundAmount()).isEqualByComparingTo("575.00");

        // Dokan stock was -3, restocked with 1 bottle -> becomes -2.000
        StockInventory step4Dokan = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "DOKAN").orElseThrow();
        assertThat(step4Dokan.getQuantity()).isEqualByComparingTo("-2.000");

        // Customer due: was 18,390.00, credited 575.00 -> 17,815.00
        Customer customerAfterReturn = customerRepository.findById(customer.getId()).orElseThrow();
        assertThat(customerAfterReturn.getCurrentDue()).isEqualByComparingTo("17815.00");

        // Customer ledger audit verification
        List<CustomerLedger> ledgersAfterReturn = customerLedgerRepository.findByCustomerIdOrderByTransactionDateDescIdDesc(customer.getId());
        CustomerLedger latestReturnLedger = ledgersAfterReturn.get(0);
        assertThat(latestReturnLedger.getTransactionType()).isEqualTo("RETURN_CREDIT");
        assertThat(latestReturnLedger.getCredit()).isEqualByComparingTo("575.00");
        assertThat(latestReturnLedger.getBalanceAfter()).isEqualByComparingTo("17815.00");


        // =========================================================================
        // Step 5: Debt Repayment
        // Repay ৳2,000 cash with MR No MR-E2E-999.
        // Verify customer due drops by ৳2,000, ledger row has MR number.
        // =========================================================================
        log.info("--- Step 5: Debt Repayment ---");
        CustomerPaymentRequest payReq = CustomerPaymentRequest.builder()
                .amount(new BigDecimal("2000.00"))
                .moneyReceiptNo("MR-E2E-999")
                .paymentMethod("CASH")
                .notes("Partial cash collection from field visit")
                .build();

        // BUSINESS DECISION: Customer due repayments create CASH_PAYMENT ledger entries capturing Money Receipt (MR No.) voucher numbers for audit verification.
        CustomerLedger paymentLedger = customerService.recordPayment(customer.getId(), payReq);

        assertThat(paymentLedger).isNotNull();
        assertThat(paymentLedger.getTransactionType()).isEqualTo("CASH_PAYMENT");
        assertThat(paymentLedger.getCredit()).isEqualByComparingTo("2000.00");
        assertThat(paymentLedger.getMoneyReceiptNo()).isEqualTo("MR-E2E-999");
        assertThat(paymentLedger.getBalanceAfter()).isEqualByComparingTo("15815.00");

        // Verify customer due dropped from 17,815 to 15,815
        Customer customerAfterPayment = customerRepository.findById(customer.getId()).orElseThrow();
        assertThat(customerAfterPayment.getCurrentDue()).isEqualByComparingTo("15815.00");


        // =========================================================================
        // Step 6: Dashboard Summary
        // Verify getSummary() cash in drawer, market due, and sales metrics match.
        // =========================================================================
        log.info("--- Step 6: Dashboard Summary ---");
        DashboardSummaryDto summary = dashboardService.getSummary();

        assertThat(summary).isNotNull();

        // Total sales today: Step 2 wholesale (11,390.00) + Step 3 retail (14,950.00) = ৳26,340.00
        assertThat(summary.getTotalSalesToday()).isEqualByComparingTo(baselineSales.add(new BigDecimal("26340.00")));

        // Gross profit today: Step 2 (1,390.00) + Step 3 ((650 - 500) * 23 = 3,450.00) = ৳4,840.00
        assertThat(summary.getGrossProfitToday()).isEqualByComparingTo(baselineProfit.add(new BigDecimal("4840.00")));

        // Cash in drawer today: sales cash (5,000.00 + 14,950.00 = 19,950.00) + repayment cash (2,000.00) - refunds cash (0.00) = ৳21,950.00
        assertThat(summary.getCashInDrawerToday()).isEqualByComparingTo(baselineCash.add(new BigDecimal("21950.00")));

        // Total market due: Rafiqul Islam outstanding balance = ৳15,815.00
        assertThat(summary.getTotalMarketDue()).isEqualByComparingTo("15815.00");

        // Total registered customers
        assertThat(summary.getTotalCustomers()).isGreaterThanOrEqualTo(2);


        // =========================================================================
        // Step 7: 1-Click SQL Backup
        // Verify exportSqlBackup() produces valid SQL statements.
        // =========================================================================
        log.info("--- Step 7: 1-Click SQL Backup ---");
        byte[] backupBytes = backupService.exportSqlBackup();

        assertThat(backupBytes).isNotNull();
        assertThat(backupBytes.length).isGreaterThan(0);

        String sqlDump = new String(backupBytes, StandardCharsets.UTF_8);
        assertThat(sqlDump).contains("Database Backup");
        assertThat(sqlDump).contains("INSERT INTO");
        assertThat(sqlDump).contains("CH-E2E-001");
        assertThat(sqlDump).contains("LOT-E2E-AMI-01");

        String backupFileName = backupService.getBackupFileName();
        assertThat(backupFileName).startsWith("syngenta-pos-backup-");
        assertThat(backupFileName).endsWith(".sql");

        log.info("=== Syngenta E2E Business Flow Test Completed Successfully! ===");
    }
}
