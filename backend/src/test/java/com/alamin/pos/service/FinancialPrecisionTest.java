package com.alamin.pos.service;

import com.alamin.pos.dto.CustomerPaymentRequest;
import com.alamin.pos.dto.DashboardSummaryDto;
import com.alamin.pos.dto.SaleItemRequest;
import com.alamin.pos.dto.SaleRequest;
import com.alamin.pos.dto.SaleResponse;
import com.alamin.pos.entity.Customer;
import com.alamin.pos.entity.CustomerLedger;
import com.alamin.pos.entity.InventoryLot;
import com.alamin.pos.exception.ValidationException;
import com.alamin.pos.repository.CustomerRepository;
import com.alamin.pos.repository.InventoryLotRepository;
import com.alamin.pos.repository.ProductRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Transactional
class FinancialPrecisionTest {

    @Autowired
    private SaleService saleService;

    @Autowired
    private CustomerService customerService;

    @Autowired
    private DashboardService dashboardService;

    @Autowired
    private InventoryLotRepository inventoryLotRepository;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private ProductRepository productRepository;

    @Test
    @DisplayName("Verify round-off is deducted from line profit in SaleResponse and Dashboard")
    void testRoundOffDeductedFromProfit() {
        InventoryLot lot = inventoryLotRepository.findByBarcode("SYN-AMI-202502").orElseThrow();
        // unitCost = 500.00, selling price = 650.00 -> unit profit = 150.00
        // Qty = 2 -> total line profit = 300.00
        // Subtotal = 1300.00
        // Discount = 20.00, RoundOff = 5.00 -> Total = 1275.00
        // Expected Profit: 300 - 20 - 5 = 275.00

        SaleRequest request = SaleRequest.builder()
                .saleMode("RETAIL")
                .discount(new BigDecimal("20.00"))
                .roundOff(new BigDecimal("5.00"))
                .cashPaid(new BigDecimal("1275.00"))
                .cashTendered(new BigDecimal("1300.00"))
                .items(List.of(
                        SaleItemRequest.builder()
                                .lotId(lot.getId())
                                .totalQuantity(new BigDecimal("2.000"))
                                .dokanQuantity(new BigDecimal("2.000"))
                                .godownQuantity(BigDecimal.ZERO)
                                .unitPrice(new BigDecimal("650.00"))
                                .build()
                ))
                .build();

        SaleResponse response = saleService.processSale(request);

        assertThat(response.getSubtotal()).isEqualByComparingTo("1300.00");
        assertThat(response.getTotalAmount()).isEqualByComparingTo("1275.00");
        assertThat(response.getTotalProfit()).as("Total profit must deduct roundOff alongside discount").isEqualByComparingTo("275.00");
        assertThat(response.getCashTendered()).isEqualByComparingTo("1300.00");
        assertThat(response.getChangeAmount()).isEqualByComparingTo("25.00");
    }

    @Test
    @DisplayName("Verify discount + roundOff exceeding subtotal is rejected")
    void testExcessiveDiscountRejected() {
        InventoryLot lot = inventoryLotRepository.findByBarcode("SYN-AMI-202502").orElseThrow();

        SaleRequest request = SaleRequest.builder()
                .saleMode("RETAIL")
                .discount(new BigDecimal("600.00"))
                .roundOff(new BigDecimal("100.00"))
                .items(List.of(
                        SaleItemRequest.builder()
                                .lotId(lot.getId())
                                .totalQuantity(new BigDecimal("1.000"))
                                .dokanQuantity(new BigDecimal("1.000"))
                                .godownQuantity(BigDecimal.ZERO)
                                .unitPrice(new BigDecimal("650.00"))
                                .build()
                ))
                .build();

        // subtotal = 650, discount+roundOff = 700 -> totalAmount = -50
        assertThatThrownBy(() -> saleService.processSale(request))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("cannot exceed subtotal");
    }

    @Test
    @DisplayName("Verify digital customer repayment records MFS_PAYMENT and does not alter cashInDrawer")
    void testDigitalRepaymentSegregation() {
        Customer customer = customerRepository.findByPhone("01711000001").orElseThrow();
        DashboardSummaryDto baseline = dashboardService.getSummary();
        BigDecimal initialDrawer = baseline.getCashInDrawerToday();

        CustomerPaymentRequest paymentReq = CustomerPaymentRequest.builder()
                .amount(new BigDecimal("1000.00"))
                .paymentMethod("BKASH")
                .moneyReceiptNo("BK-TRX-8888")
                .notes("bKash digital repayment")
                .build();

        CustomerLedger ledger = customerService.recordPayment(customer.getId(), paymentReq);

        assertThat(ledger.getTransactionType()).isEqualTo("MFS_PAYMENT");
        assertThat(ledger.getCredit()).isEqualByComparingTo("1000.00");

        DashboardSummaryDto updated = dashboardService.getSummary();
        assertThat(updated.getCashInDrawerToday())
                .as("Digital payment must not increase physical cashInDrawer")
                .isEqualByComparingTo(initialDrawer);
    }
}
