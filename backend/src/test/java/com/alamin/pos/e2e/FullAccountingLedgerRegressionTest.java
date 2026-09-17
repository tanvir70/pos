package com.alamin.pos.e2e;

import com.alamin.pos.dto.*;
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
import com.alamin.pos.service.CustomerService;
import com.alamin.pos.service.SaleReturnService;
import com.alamin.pos.service.SaleService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
public class FullAccountingLedgerRegressionTest {

    @Autowired
    private SaleService saleService;

    @Autowired
    private SaleReturnService saleReturnService;

    @Autowired
    private CustomerService customerService;

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

    @Test
    @DisplayName("Complete Financial & Ledger Lifecycle: Cash sale -> Credit sale -> Return -> Repayment -> Accounting verification")
    void testCompleteAccountingLifecycle() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Product product = productRepository.save(Product.builder()
                .productCode("PROD-LIFE-" + suffix)
                .nameEn("Lifecycle Product " + suffix)
                .nameBn("লাইফসাইকেল পণ্য")
                .category("FUNGICIDE")
                .baseUnit("Bottle")
                .cartonMultiplier(BigDecimal.ONE)
                .standardRetailPrice(new BigDecimal("500.00"))
                .standardWholesalePrice(new BigDecimal("480.00"))
                .build());

        // 1. Setup dedicated customer & lot
        Customer customer = customerRepository.save(Customer.builder()
                .name("Lifecycle Farmer " + suffix)
                .phone("01799" + suffix.replaceAll("[^0-9]", "1").substring(0, 6))
                .customerType("FARMER")
                .creditLimit(new BigDecimal("20000.00"))
                .currentDue(BigDecimal.ZERO)
                .build());

        InventoryLot lot = inventoryLotRepository.save(InventoryLot.builder()
                .product(product)
                .lotNumber("LOT-LIFE-" + suffix)
                .barcode("BAR-LIFE-" + suffix)
                .entryDate(LocalDate.now())
                .expiryDate(LocalDate.now().plusYears(5))
                .purchaseCost(new BigDecimal("400.00"))
                .lotRetailPrice(new BigDecimal("500.00"))
                .lotWholesalePrice(new BigDecimal("480.00"))
                .build());

        stockInventoryRepository.save(StockInventory.builder()
                .lot(lot)
                .location("DOKAN")
                .quantity(new BigDecimal("100.000"))
                .build());

        // Step 1: Cash sale of 2 units with discount and round-off
        // Subtotal = 1000.00, discount = 50.00, roundOff = 5.00 -> totalAmount = 945.00
        // cashPaid = 945.00, cashTendered = 1000.00 -> changeAmount = 55.00
        SaleItemRequest cashItem = SaleItemRequest.builder()
                .lotId(lot.getId())
                .totalQuantity(new BigDecimal("2.000"))
                .dokanQuantity(new BigDecimal("2.000"))
                .godownQuantity(BigDecimal.ZERO)
                .unitPrice(new BigDecimal("500.00"))
                .build();

        SaleRequest cashSaleRequest = SaleRequest.builder()
                .saleMode("RETAIL")
                .items(List.of(cashItem))
                .discount(new BigDecimal("50.00"))
                .roundOff(new BigDecimal("5.00"))
                .paymentMethod("CASH")
                .cashPaid(new BigDecimal("945.00"))
                .cashTendered(new BigDecimal("1000.00"))
                .build();

        SaleResponse cashSale = saleService.processSale(cashSaleRequest);

        // Profit: (500 - 400)*2 - 50 - 5 = 145.00
        assertThat(cashSale.getTotalAmount()).isEqualByComparingTo("945.00");
        assertThat(cashSale.getChangeAmount()).isEqualByComparingTo("55.00");
        assertThat(cashSale.getTotalProfit()).isEqualByComparingTo("145.00");

        // Step 2: Partial credit sale of 2 units to customer
        // Subtotal = 1000.00, cashPaid = 200.00 -> dueAmount = 800.00
        SaleItemRequest creditItem = SaleItemRequest.builder()
                .lotId(lot.getId())
                .totalQuantity(new BigDecimal("2.000"))
                .dokanQuantity(new BigDecimal("2.000"))
                .godownQuantity(BigDecimal.ZERO)
                .unitPrice(new BigDecimal("500.00"))
                .build();

        SaleRequest creditSaleRequest = SaleRequest.builder()
                .customerId(customer.getId())
                .saleMode("RETAIL")
                .items(List.of(creditItem))
                .paymentMethod("SPLIT")
                .cashPaid(new BigDecimal("200.00"))
                .cashTendered(new BigDecimal("200.00"))
                .build();

        SaleResponse creditSale = saleService.processSale(creditSaleRequest);
        assertThat(creditSale.getDueAmount()).isEqualByComparingTo("800.00");

        Customer customerAfterCredit = customerRepository.findById(customer.getId()).orElseThrow();
        assertThat(customerAfterCredit.getCurrentDue()).isEqualByComparingTo("800.00");

        // Step 3: Customer returns 1 unit from credit sale with DUE_ADJUSTMENT
        SaleReturnItemRequest returnItem = SaleReturnItemRequest.builder()
                .lotId(lot.getId())
                .quantity(new BigDecimal("1.000"))
                .refundPrice(new BigDecimal("500.00"))
                .isDamaged(false)
                .restockLocation("DOKAN")
                .build();

        SaleReturnRequest returnRequest = SaleReturnRequest.builder()
                .originalSaleId(creditSale.getId())
                .customerId(customer.getId())
                .refundType("DUE_ADJUSTMENT")
                .reason("Defective container seal")
                .items(List.of(returnItem))
                .build();

        SaleReturnResponse returnResponse = saleReturnService.processReturn(returnRequest);
        assertThat(returnResponse.getTotalRefundAmount()).isEqualByComparingTo("500.00");

        Customer customerAfterReturn = customerRepository.findById(customer.getId()).orElseThrow();
        assertThat(customerAfterReturn.getCurrentDue()).isEqualByComparingTo("300.00"); // 800 - 500 = 300

        // Step 4: Customer repays remaining 300 Tk via bKash (MFS_PAYMENT)
        CustomerPaymentRequest payment = CustomerPaymentRequest.builder()
                .amount(new BigDecimal("300.00"))
                .paymentMethod("BKASH")
                .moneyReceiptNo("MR-BKASH-" + suffix)
                .notes("Clear remaining due via bKash")
                .build();

        customerService.recordPayment(customer.getId(), payment);

        Customer customerAfterPayment = customerRepository.findById(customer.getId()).orElseThrow();
        assertThat(customerAfterPayment.getCurrentDue()).isEqualByComparingTo("0.00");

        // Step 5: Audit ledger integrity
        List<CustomerLedger> ledger = customerLedgerRepository.findByCustomerIdOrderByTransactionDateDescIdDesc(customer.getId());
        assertThat(ledger).hasSize(3); // INVOICE_BILL (800) -> RETURN_CREDIT (500) -> MFS_PAYMENT (300)

        CustomerLedger repaymentEntry = ledger.get(0);
        assertThat(repaymentEntry.getTransactionType()).isEqualTo("MFS_PAYMENT");
        assertThat(repaymentEntry.getCredit()).isEqualByComparingTo("300.00");
        assertThat(repaymentEntry.getBalanceAfter()).isEqualByComparingTo("0.00");

        CustomerLedger returnEntry = ledger.get(1);
        assertThat(returnEntry.getTransactionType()).isEqualTo("RETURN_CREDIT");
        assertThat(returnEntry.getCredit()).isEqualByComparingTo("500.00");
        assertThat(returnEntry.getBalanceAfter()).isEqualByComparingTo("300.00");

        CustomerLedger billEntry = ledger.get(2);
        assertThat(billEntry.getTransactionType()).isEqualTo("INVOICE_BILL");
        assertThat(billEntry.getDebit()).isEqualByComparingTo("800.00");
        assertThat(billEntry.getBalanceAfter()).isEqualByComparingTo("800.00");

        // Ending stock check: started with 100, sold 2 (cash), sold 2 (credit), returned 1 (restocked) = 97 units
        StockInventory endingStock = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "DOKAN").orElseThrow();
        assertThat(endingStock.getQuantity()).isEqualByComparingTo("97.000");
    }
}
