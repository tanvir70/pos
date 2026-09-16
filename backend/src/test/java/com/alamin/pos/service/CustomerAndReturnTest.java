package com.alamin.pos.service;

import com.alamin.pos.dto.CustomerPaymentRequest;
import com.alamin.pos.dto.CustomerRequest;
import com.alamin.pos.dto.SaleReturnItemRequest;
import com.alamin.pos.dto.SaleReturnRequest;
import com.alamin.pos.dto.SaleReturnResponse;
import com.alamin.pos.entity.Customer;
import com.alamin.pos.entity.CustomerLedger;
import com.alamin.pos.entity.GodownMovement;
import com.alamin.pos.entity.InventoryLot;
import com.alamin.pos.entity.StockInventory;
import com.alamin.pos.repository.CustomerLedgerRepository;
import com.alamin.pos.repository.CustomerRepository;
import com.alamin.pos.repository.GodownMovementRepository;
import com.alamin.pos.repository.InventoryLotRepository;
import com.alamin.pos.repository.StockInventoryRepository;
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
class CustomerAndReturnTest {

    @Autowired
    private CustomerService customerService;

    @Autowired
    private SaleReturnService saleReturnService;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private CustomerLedgerRepository customerLedgerRepository;

    @Autowired
    private InventoryLotRepository inventoryLotRepository;

    @Autowired
    private StockInventoryRepository stockInventoryRepository;

    @Autowired
    private GodownMovementRepository godownMovementRepository;

    @Test
    @DisplayName("1. Customer Creation & Query: Create wholesale dealer with MFS and credit limit, verify retrieval")
    void testCustomerCreationAndQuery() {
        CustomerRequest request = CustomerRequest.builder()
                .name("মেসার্স সরকার এগ্রো")
                .fatherName("আলহাজ্ব মকবুল সরকার")
                .businessName("সরকার এগ্রো ট্রেডার্স")
                .phone("01799887766")
                .whatsappNumber("01799887766")
                .email("sarkar.agro@example.com")
                .villageAddress("নালিতাবাড়ী বাজার, শেরপুর")
                .customerType("WHOLESALE")
                .creditLimit(new BigDecimal("200000.00"))
                .initialDue(BigDecimal.ZERO)
                .mfsType("BKASH")
                .mfsNumber("01799887766")
                .bankName("Sonali Bank PLC")
                .bankBranch("Nalitabari Branch")
                .bankAccountNo("123456789012")
                .build();

        Customer created = customerService.createCustomer(request);

        assertThat(created).isNotNull();
        assertThat(created.getId()).isNotNull();
        assertThat(created.getName()).isEqualTo("মেসার্স সরকার এগ্রো");
        assertThat(created.getCustomerType()).isEqualTo("WHOLESALE");
        assertThat(created.getCreditLimit()).isEqualByComparingTo("200000.00");
        assertThat(created.getMfsType()).isEqualTo("BKASH");

        Customer retrieved = customerService.getCustomer(created.getId());
        assertThat(retrieved.getBusinessName()).isEqualTo("সরকার এগ্রো ট্রেডার্স");

        List<Customer> searchResults = customerService.searchCustomers("সরকার", "WHOLESALE");
        assertThat(searchResults).isNotEmpty();
        assertThat(searchResults.stream().anyMatch(c -> c.getId().equals(created.getId()))).isTrue();
    }

    @Test
    @DisplayName("2. Customer Due Repayment: Customer has 15,000 due; pays 5,000 with MR No 'MR-1001'; verify due drops to 10,000, ledger row created with balance 10,000 and MR number")
    void testCustomerDueRepayment() {
        Customer customer = customerRepository.findByPhone("01711000001").orElseThrow();
        assertThat(customer.getCurrentDue()).isEqualByComparingTo("15000.00");

        CustomerPaymentRequest payReq = CustomerPaymentRequest.builder()
                .amount(new BigDecimal("5000.00"))
                .moneyReceiptNo("MR-1001")
                .paymentMethod("CASH")
                .notes("Partial seasonal repayment")
                .build();

        CustomerLedger ledger = customerService.recordPayment(customer.getId(), payReq);

        Customer updatedCustomer = customerService.getCustomer(customer.getId());
        assertThat(updatedCustomer.getCurrentDue()).isEqualByComparingTo("10000.00");

        assertThat(ledger.getTransactionType()).isEqualTo("CASH_PAYMENT");
        assertThat(ledger.getCredit()).isEqualByComparingTo("5000.00");
        assertThat(ledger.getDebit()).isEqualByComparingTo("0.00");
        assertThat(ledger.getBalanceAfter()).isEqualByComparingTo("10000.00");
        assertThat(ledger.getMoneyReceiptNo()).isEqualTo("MR-1001");
        assertThat(ledger.getNotes()).isEqualTo("Partial seasonal repayment");

        List<CustomerLedger> ledgers = customerService.getCustomerLedger(customer.getId());
        assertThat(ledgers).isNotEmpty();
        assertThat(ledgers.get(0).getId()).isEqualTo(ledger.getId());
    }

    @Test
    @DisplayName("3. Direct Return Without Invoice (Restock to Dokan): Return 2 bottles without original invoice; verify Dokan stock increases by 2; refund cash")
    void testDirectReturnWithoutInvoiceRestockDokan() {
        InventoryLot lot = inventoryLotRepository.findByBarcode("SYN-AMI-202502").orElseThrow();
        StockInventory dokanStock = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "DOKAN").orElseThrow();
        BigDecimal startDokanQty = dokanStock.getQuantity();

        SaleReturnItemRequest returnItem = SaleReturnItemRequest.builder()
                .lotId(lot.getId())
                .quantity(new BigDecimal("2.000"))
                .refundPrice(new BigDecimal("650.00"))
                .isDamaged(false)
                .restockLocation("DOKAN")
                .build();

        SaleReturnRequest returnReq = SaleReturnRequest.builder()
                .originalSaleId(null) // Direct receipt-less return
                .refundType("CASH_REFUND")
                .reason("Farmer purchased extra bottles without receipt")
                .items(List.of(returnItem))
                .build();

        SaleReturnResponse response = saleReturnService.processReturn(returnReq);

        assertThat(response).isNotNull();
        assertThat(response.getReturnNo()).startsWith("RET-");
        assertThat(response.getTotalRefundAmount()).isEqualByComparingTo("1300.00");
        assertThat(response.getRefundType()).isEqualTo("CASH_REFUND");
        assertThat(response.getItems()).hasSize(1);

        StockInventory updatedDokan = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "DOKAN").orElseThrow();
        assertThat(updatedDokan.getQuantity()).isEqualByComparingTo(startDokanQty.add(new BigDecimal("2.000")));
    }

    @Test
    @DisplayName("4. Direct Return with Due Adjustment: Return 3 bottles without invoice, adjust due of customer with 10,000 due -> customer due drops to 8,050, RETURN_CREDIT ledger created")
    void testDirectReturnWithDueAdjustment() {
        Customer customer = customerRepository.findByPhone("01711000001").orElseThrow();
        customer.setCurrentDue(new BigDecimal("10000.00"));
        customerRepository.save(customer);

        InventoryLot lot = inventoryLotRepository.findByBarcode("SYN-AMI-202502").orElseThrow();

        // 3 bottles of Amistar Top @ 650.00 = 1,950.00 refund
        SaleReturnItemRequest returnItem = SaleReturnItemRequest.builder()
                .lotId(lot.getId())
                .quantity(new BigDecimal("3.000"))
                .refundPrice(new BigDecimal("650.00"))
                .isDamaged(false)
                .restockLocation("DOKAN")
                .build();

        SaleReturnRequest returnReq = SaleReturnRequest.builder()
                .customerId(customer.getId())
                .refundType("DUE_ADJUSTMENT")
                .reason("Unopened bottles credited against dealer due balance")
                .items(List.of(returnItem))
                .build();

        SaleReturnResponse response = saleReturnService.processReturn(returnReq);

        assertThat(response.getTotalRefundAmount()).isEqualByComparingTo("1950.00");

        // Customer due: 10,000 - 1,950 = 8,050.00
        Customer updatedCustomer = customerService.getCustomer(customer.getId());
        assertThat(updatedCustomer.getCurrentDue()).isEqualByComparingTo("8050.00");

        List<CustomerLedger> ledgers = customerService.getCustomerLedger(customer.getId());
        CustomerLedger latestLedger = ledgers.get(0);
        assertThat(latestLedger.getTransactionType()).isEqualTo("RETURN_CREDIT");
        assertThat(latestLedger.getCredit()).isEqualByComparingTo("1950.00");
        assertThat(latestLedger.getDebit()).isEqualByComparingTo("0.00");
        assertThat(latestLedger.getBalanceAfter()).isEqualByComparingTo("8050.00");
        assertThat(latestLedger.getNotes()).contains("Return Credit: " + response.getReturnNo());
    }

    @Test
    @DisplayName("5. Damaged Item Return: Return 1 damaged packet; verify sellable stock is NOT incremented")
    void testDamagedItemReturn() {
        InventoryLot lot = inventoryLotRepository.findByBarcode("SYN-VIR-202601").orElseThrow();
        StockInventory dokanStock = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "DOKAN").orElseThrow();
        BigDecimal startDokanQty = dokanStock.getQuantity();

        SaleReturnItemRequest returnItem = SaleReturnItemRequest.builder()
                .lotId(lot.getId())
                .quantity(new BigDecimal("1.000"))
                .refundPrice(new BigDecimal("350.00"))
                .isDamaged(true) // Damaged!
                .restockLocation("DOKAN")
                .build();

        SaleReturnRequest returnReq = SaleReturnRequest.builder()
                .refundType("CASH_REFUND")
                .reason("Defective torn packet returned by farmer")
                .items(List.of(returnItem))
                .build();

        SaleReturnResponse response = saleReturnService.processReturn(returnReq);

        assertThat(response).isNotNull();
        assertThat(response.getTotalRefundAmount()).isEqualByComparingTo("350.00");

        // Sellable stock MUST NOT be incremented
        StockInventory updatedDokan = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "DOKAN").orElseThrow();
        assertThat(updatedDokan.getQuantity()).isEqualByComparingTo(startDokanQty);
    }

    @Test
    @DisplayName("6. Validation: Due adjustment without customer throws IllegalArgumentException")
    void testValidationDueAdjustmentWithoutCustomerThrowsException() {
        InventoryLot lot = inventoryLotRepository.findByBarcode("SYN-AMI-202502").orElseThrow();

        SaleReturnItemRequest returnItem = SaleReturnItemRequest.builder()
                .lotId(lot.getId())
                .quantity(new BigDecimal("1.000"))
                .refundPrice(new BigDecimal("650.00"))
                .isDamaged(false)
                .build();

        SaleReturnRequest returnReq = SaleReturnRequest.builder()
                .customerId(null) // No customer specified
                .refundType("DUE_ADJUSTMENT")
                .items(List.of(returnItem))
                .build();

        assertThatThrownBy(() -> saleReturnService.processReturn(returnReq))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Customer is required for DUE_ADJUSTMENT refund");
    }

    @Test
    @DisplayName("7. Restock to Godown: Godown stock increases and GodownMovement RETURN_ENTRY is logged")
    void testRestockToGodownLogsMovement() {
        InventoryLot lot = inventoryLotRepository.findByBarcode("SYN-AMI-202502").orElseThrow();
        StockInventory godownStock = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "GODOWN").orElseThrow();
        BigDecimal startGodownQty = godownStock.getQuantity();

        SaleReturnItemRequest returnItem = SaleReturnItemRequest.builder()
                .lotId(lot.getId())
                .quantity(new BigDecimal("5.000"))
                .refundPrice(new BigDecimal("580.00"))
                .isDamaged(false)
                .restockLocation("GODOWN")
                .build();

        SaleReturnRequest returnReq = SaleReturnRequest.builder()
                .refundType("CASH_REFUND")
                .reason("Bulk sub-dealer return restocked to Godown")
                .items(List.of(returnItem))
                .build();

        SaleReturnResponse response = saleReturnService.processReturn(returnReq);

        StockInventory updatedGodown = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "GODOWN").orElseThrow();
        assertThat(updatedGodown.getQuantity()).isEqualByComparingTo(startGodownQty.add(new BigDecimal("5.000")));

        List<GodownMovement> movements = godownMovementRepository.findByLotIdOrderByMovementDateDesc(lot.getId());
        assertThat(movements).isNotEmpty();
        GodownMovement latest = movements.get(0);
        assertThat(latest.getMovementType()).isEqualTo("RETURN_ENTRY");
        assertThat(latest.getQuantity()).isEqualByComparingTo("5.000");
        assertThat(latest.getReferenceNo()).isEqualTo(response.getReturnNo());
    }

    @Test
    @DisplayName("8. Query return by ID and Recent Returns list")
    void testQueryReturnMethods() {
        InventoryLot lot = inventoryLotRepository.findByBarcode("SYN-AMI-202502").orElseThrow();

        SaleReturnItemRequest returnItem = SaleReturnItemRequest.builder()
                .lotId(lot.getId())
                .quantity(new BigDecimal("1.000"))
                .refundPrice(new BigDecimal("650.00"))
                .isDamaged(false)
                .restockLocation("DOKAN")
                .build();

        SaleReturnRequest returnReq = SaleReturnRequest.builder()
                .refundType("CASH_REFUND")
                .reason("Test query return")
                .items(List.of(returnItem))
                .build();

        SaleReturnResponse created = saleReturnService.processReturn(returnReq);

        SaleReturnResponse byId = saleReturnService.getReturnById(created.getId());
        assertThat(byId.getReturnNo()).isEqualTo(created.getReturnNo());

        List<SaleReturnResponse> recent = saleReturnService.getRecentReturns(10);
        assertThat(recent).isNotEmpty();
        assertThat(recent.stream().anyMatch(r -> r.getReturnNo().equals(created.getReturnNo()))).isTrue();
    }
}
