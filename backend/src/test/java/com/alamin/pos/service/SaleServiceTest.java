package com.alamin.pos.service;

import com.alamin.pos.dto.SaleItemRequest;
import com.alamin.pos.dto.SaleItemResponse;
import com.alamin.pos.dto.SaleRequest;
import com.alamin.pos.dto.SaleResponse;
import com.alamin.pos.entity.Customer;
import com.alamin.pos.entity.CustomerLedger;
import com.alamin.pos.entity.InventoryLot;
import com.alamin.pos.entity.Product;
import com.alamin.pos.entity.StockInventory;
import com.alamin.pos.exception.BusinessRuleViolationException;
import com.alamin.pos.exception.InsufficientStockException;
import com.alamin.pos.exception.ValidationException;
import com.alamin.pos.repository.CustomerLedgerRepository;
import com.alamin.pos.repository.CustomerRepository;
import com.alamin.pos.repository.InventoryLotRepository;
import com.alamin.pos.repository.ProductRepository;
import com.alamin.pos.repository.SaleItemRepository;
import com.alamin.pos.repository.SaleRepository;
import com.alamin.pos.repository.StockInventoryRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Transactional
class SaleServiceTest {

    @Autowired
    private SaleService saleService;

    @Autowired
    private SaleRepository saleRepository;

    @Autowired
    private SaleItemRepository saleItemRepository;

    @Autowired
    private InventoryLotRepository inventoryLotRepository;

    @Autowired
    private StockInventoryRepository stockInventoryRepository;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private CustomerLedgerRepository customerLedgerRepository;

    @Autowired
    private ProductRepository productRepository;

    @Test
    @DisplayName("1. Store Stock Deduction: Selling 10 units reduces DOKAN store stock")
    void testStoreStockDeduction() {
        InventoryLot lot = inventoryLotRepository.findByBarcode("SYN-AMI-202502").orElseThrow();
        StockInventory initialDokan = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "DOKAN").orElseThrow();
        BigDecimal startDokanQty = initialDokan.getQuantity(); // 40.000 (after V4 migration)

        Customer customer = customerRepository.findByPhone("01711000001").orElseThrow();

        SaleItemRequest itemReq = SaleItemRequest.builder()
                .lotId(lot.getId())
                .totalQuantity(new BigDecimal("10.000"))
                .unitPrice(new BigDecimal("580.00"))
                .build();

        SaleRequest request = SaleRequest.builder()
                .customerId(customer.getId())
                .saleMode("WHOLESALE")
                .items(List.of(itemReq))
                .cashPaid(new BigDecimal("5800.00"))
                .paymentMethod("CASH")
                .build();

        SaleResponse response = saleService.processSale(request);

        assertThat(response).isNotNull();
        assertThat(response.getInvoiceNo()).startsWith("INV-");

        // Verify Dokan store stock decreased by 10.000
        StockInventory updatedDokan = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "DOKAN").orElseThrow();
        assertThat(updatedDokan.getQuantity()).isEqualByComparingTo(startDokanQty.subtract(new BigDecimal("10.000")));
    }

    @Test
    @DisplayName("2. Stock protection: selling more than available DOKAN stock is blocked")
    void testNegativeStockBlockedInDokan() {
        Product product = productRepository.findByProductCode("SYN-AMI-TOP").orElseThrow();

        // Create a new lot with 0 stock in Dokan
        InventoryLot lot = InventoryLot.builder()
                .product(product)
                .lotNumber("LOT-NEG-TEST")
                .entryDate(LocalDate.now())
                .expiryDate(LocalDate.of(2028, 12, 31))
                .purchaseCost(new BigDecimal("500.00"))
                .lotRetailPrice(new BigDecimal("650.00"))
                .lotWholesalePrice(new BigDecimal("580.00"))
                .barcode("SYN-NEG-001")
                .supplierName("Agro Chemical Ltd")
                .build();
        lot = inventoryLotRepository.save(lot);

        StockInventory dokanStock = StockInventory.builder()
                .lot(lot)
                .location("DOKAN")
                .quantity(BigDecimal.ZERO.setScale(3))
                .build();
        stockInventoryRepository.save(dokanStock);

        SaleItemRequest itemReq = SaleItemRequest.builder()
                .lotId(lot.getId())
                .totalQuantity(new BigDecimal("5.000"))
                .unitPrice(new BigDecimal("650.00"))
                .build();

        SaleRequest request = SaleRequest.builder()
                .saleMode("RETAIL")
                .items(List.of(itemReq))
                .cashPaid(new BigDecimal("3250.00"))
                .paymentMethod("CASH")
                .build();

        assertThatThrownBy(() -> saleService.processSale(request))
                .isInstanceOf(InsufficientStockException.class)
                .hasMessageContaining("exceeds available stock");

        // Dokan stock must remain zero and never go negative
        StockInventory updatedDokan = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "DOKAN").orElseThrow();
        assertThat(updatedDokan.getQuantity()).isEqualByComparingTo("0.000");
    }

    @Test
    @DisplayName("3. Bargaining Price Override & Round-Off: Standard price overridden to 620 with ৳20 round-off")
    void testPriceOverrideAndRoundOff() {
        InventoryLot lot = inventoryLotRepository.findByBarcode("SYN-AMI-202502").orElseThrow();
        // Standard retail is 650.00, purchaseCost is 500.00

        SaleItemRequest itemReq = SaleItemRequest.builder()
                .lotId(lot.getId())
                .totalQuantity(new BigDecimal("2.000"))
                .unitPrice(new BigDecimal("620.00")) // Bargained down from 650.00
                .build();

        SaleRequest request = SaleRequest.builder()
                .saleMode("RETAIL")
                .items(List.of(itemReq))
                .roundOff(new BigDecimal("20.00")) // Round-off adjustment
                .cashPaid(new BigDecimal("1220.00")) // (620 * 2) - 20 = 1220
                .paymentMethod("CASH")
                .build();

        SaleResponse response = saleService.processSale(request);

        assertThat(response).isNotNull();
        assertThat(response.getSubtotal()).isEqualByComparingTo("1240.00");
        assertThat(response.getRoundOff()).isEqualByComparingTo("20.00");
        assertThat(response.getTotalAmount()).isEqualByComparingTo("1220.00");

        // Verify frozen unit cost captured accurately
        assertThat(response.getItems()).hasSize(1);
        SaleItemResponse item = response.getItems().get(0);
        assertThat(item.getUnitPrice()).isEqualByComparingTo("620.00");
        assertThat(item.getUnitCost()).isEqualByComparingTo("500.00");
    }

    @Test
    @DisplayName("4. Gross Profit: Exact gross profit calculated as (unitPrice - unitCost) * qty - discount")
    void testGrossProfitCalculation() {
        InventoryLot lot = inventoryLotRepository.findByBarcode("SYN-AMI-202502").orElseThrow();
        // purchaseCost = 500.00

        SaleItemRequest itemReq = SaleItemRequest.builder()
                .lotId(lot.getId())
                .totalQuantity(new BigDecimal("2.000"))
                .unitPrice(new BigDecimal("620.00"))
                .build();

        // subtotal = 1240.00, discount = 40.00, totalAmount = 1200.00
        // Expected gross profit: (620 - 500) * 2 - 40 = 240 - 40 = 200.00
        SaleRequest request = SaleRequest.builder()
                .saleMode("RETAIL")
                .items(List.of(itemReq))
                .discount(new BigDecimal("40.00"))
                .cashPaid(new BigDecimal("1200.00"))
                .paymentMethod("CASH")
                .build();

        SaleResponse response = saleService.processSale(request);

        assertThat(response.getSubtotal()).isEqualByComparingTo("1240.00");
        assertThat(response.getDiscount()).isEqualByComparingTo("40.00");
        assertThat(response.getTotalAmount()).isEqualByComparingTo("1200.00");
        assertThat(response.getTotalProfit()).isEqualByComparingTo("200.00");
    }

    @Test
    @DisplayName("5. Multi-Payment Split: Cash ৳500 + bKash ৳300 + Due ৳200 updates customer due and ledger")
    void testMultiPaymentWithDue() {
        Customer customer = customerRepository.findByPhone("01711000001").orElseThrow();
        BigDecimal initialDue = customer.getCurrentDue(); // 15000.00

        InventoryLot lot = inventoryLotRepository.findByBarcode("SYN-AMI-202502").orElseThrow();

        SaleItemRequest itemReq = SaleItemRequest.builder()
                .lotId(lot.getId())
                .totalQuantity(new BigDecimal("2.000"))
                .unitPrice(new BigDecimal("500.00")) // subtotal = 1000.00
                .build();

        SaleRequest request = SaleRequest.builder()
                .customerId(customer.getId())
                .saleMode("WHOLESALE")
                .items(List.of(itemReq))
                .paymentMethod("SPLIT")
                .cashPaid(new BigDecimal("500.00"))
                .digitalPaid(new BigDecimal("300.00"))
                .digitalMedium("BKASH")
                .digitalTrxId("TRX-TEST-12345")
                .build();

        SaleResponse response = saleService.processSale(request);

        assertThat(response.getTotalAmount()).isEqualByComparingTo("1000.00");
        assertThat(response.getCashPaid()).isEqualByComparingTo("500.00");
        assertThat(response.getDigitalPaid()).isEqualByComparingTo("300.00");
        assertThat(response.getDueAmount()).isEqualByComparingTo("200.00");

        // Customer currentDue should increase by 200.00
        Customer updatedCustomer = customerRepository.findById(customer.getId()).orElseThrow();
        assertThat(updatedCustomer.getCurrentDue()).isEqualByComparingTo(initialDue.add(new BigDecimal("200.00")));

        // Customer ledger must have an INVOICE_BILL record
        List<CustomerLedger> ledgers = customerLedgerRepository.findByCustomerIdOrderByTransactionDateDesc(customer.getId());
        CustomerLedger latestLedger = ledgers.get(0);
        assertThat(latestLedger.getTransactionType()).isEqualTo("INVOICE_BILL");
        assertThat(latestLedger.getDebit()).isEqualByComparingTo("200.00");
        assertThat(latestLedger.getCredit()).isEqualByComparingTo("0.00");
        assertThat(latestLedger.getBalanceAfter()).isEqualByComparingTo(initialDue.add(new BigDecimal("200.00")));
        assertThat(latestLedger.getSaleId()).isEqualTo(response.getId());
    }

    @Test
    @DisplayName("6. Anonymous Due Validation: Due sale without customer fails with BusinessRuleViolationException")
    void testAnonymousCustomerWithDueThrowsException() {
        InventoryLot lot = inventoryLotRepository.findByBarcode("SYN-AMI-202502").orElseThrow();

        SaleItemRequest itemReq = SaleItemRequest.builder()
                .lotId(lot.getId())
                .totalQuantity(new BigDecimal("1.000"))
                .unitPrice(new BigDecimal("650.00"))
                .build();

        SaleRequest request = SaleRequest.builder()
                .customerId(null) // Anonymous walk-in
                .saleMode("RETAIL")
                .items(List.of(itemReq))
                .cashPaid(new BigDecimal("400.00")) // Leaves 250 due
                .paymentMethod("CASH")
                .build();

        assertThatThrownBy(() -> saleService.processSale(request))
                .isInstanceOf(BusinessRuleViolationException.class)
                .hasMessageContaining("Cannot have due amount for anonymous walk-in customer");
    }

    @Test
    @DisplayName("7. Query sale by ID, Invoice No, and Recent Sales")
    void testQuerySaleMethods() {
        InventoryLot lot = inventoryLotRepository.findByBarcode("SYN-AMI-202502").orElseThrow();

        SaleItemRequest itemReq = SaleItemRequest.builder()
                .lotId(lot.getId())
                .totalQuantity(new BigDecimal("1.000"))
                .unitPrice(new BigDecimal("650.00"))
                .build();

        SaleRequest request = SaleRequest.builder()
                .saleMode("RETAIL")
                .items(List.of(itemReq))
                .cashPaid(new BigDecimal("650.00"))
                .cashierName("Tanvir")
                .build();

        SaleResponse created = saleService.processSale(request);

        SaleResponse byId = saleService.getSaleById(created.getId());
        assertThat(byId.getInvoiceNo()).isEqualTo(created.getInvoiceNo());
        assertThat(byId.getCashierName()).isEqualTo("Tanvir");

        SaleResponse byInvoice = saleService.getSaleByInvoiceNo(created.getInvoiceNo());
        assertThat(byInvoice.getId()).isEqualTo(created.getId());

        List<SaleResponse> recent = saleService.getRecentSales(10);
        assertThat(recent).isNotEmpty();
        assertThat(recent.stream().anyMatch(s -> s.getInvoiceNo().equals(created.getInvoiceNo()))).isTrue();
    }

    @Test
    @DisplayName("8. Validation: Total quantity <= 0 throws ValidationException")
    void testZeroQuantityThrowsValidationException() {
        InventoryLot lot = inventoryLotRepository.findByBarcode("SYN-AMI-202502").orElseThrow();

        SaleItemRequest itemReq = SaleItemRequest.builder()
                .lotId(lot.getId())
                .totalQuantity(BigDecimal.ZERO)
                .unitPrice(new BigDecimal("650.00"))
                .build();

        SaleRequest request = SaleRequest.builder()
                .saleMode("RETAIL")
                .items(List.of(itemReq))
                .cashPaid(new BigDecimal("650.00"))
                .build();

        assertThatThrownBy(() -> saleService.processSale(request))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("Total quantity must be greater than zero");
    }
}
