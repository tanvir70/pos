package com.alamin.pos.service;

import com.alamin.pos.dto.CustomerPaymentRequest;
import com.alamin.pos.dto.CustomerRequest;
import com.alamin.pos.dto.SaleReturnItemRequest;
import com.alamin.pos.dto.SaleReturnRequest;
import com.alamin.pos.dto.SaleReturnResponse;
import com.alamin.pos.entity.Customer;
import com.alamin.pos.entity.CustomerLedger;
import com.alamin.pos.entity.InventoryLot;
import com.alamin.pos.entity.StockInventory;
import com.alamin.pos.exception.BusinessRuleViolationException;
import com.alamin.pos.exception.DuplicateResourceException;
import com.alamin.pos.exception.ValidationException;
import com.alamin.pos.repository.CustomerLedgerRepository;
import com.alamin.pos.repository.CustomerRepository;
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
        assertThat(created.getTotalPurchases()).isEqualByComparingTo("0.00");
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

        CustomerPaymentRequest paymentRequest = CustomerPaymentRequest.builder()
                .amount(new BigDecimal("5000.00"))
                .paymentMethod("CASH")
                .moneyReceiptNo("MR-1001")
                .notes("Partial repayment for seasonal credit")
                .build();

        CustomerLedger paymentResult = customerService.recordPayment(customer.getId(), paymentRequest);
        Customer updatedCustomer = customerService.getCustomer(customer.getId());

        assertThat(updatedCustomer.getCurrentDue()).isEqualByComparingTo("10000.00");

        List<CustomerLedger> ledgers = customerService.getCustomerLedger(customer.getId());
        assertThat(ledgers).isNotEmpty();

        CustomerLedger latestLedger = ledgers.get(0);
        assertThat(latestLedger.getTransactionType()).isEqualTo("CASH_PAYMENT");
        assertThat(latestLedger.getCredit()).isEqualByComparingTo("5000.00");
        assertThat(latestLedger.getDebit()).isEqualByComparingTo("0.00");
        assertThat(latestLedger.getBalanceAfter()).isEqualByComparingTo("10000.00");
        assertThat(latestLedger.getMoneyReceiptNo()).isEqualTo("MR-1001");
        assertThat(latestLedger.getNotes()).isEqualTo("Partial repayment for seasonal credit");
    }

    @Test
    @DisplayName("3. Direct Sale Return (Cash Refund): Return 2 bottles without original invoice, refund ৳1,300 cash, increments DOKAN stock")
    void testDirectSaleReturnCash() {
        InventoryLot lot = inventoryLotRepository.findByBarcode("SYN-AMI-202502").orElseThrow();
        StockInventory dokanStock = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "DOKAN").orElseThrow();
        BigDecimal startDokanQty = dokanStock.getQuantity();

        SaleReturnItemRequest returnItem = SaleReturnItemRequest.builder()
                .lotId(lot.getId())
                .quantity(new BigDecimal("2.000"))
                .refundPrice(new BigDecimal("650.00"))
                .isDamaged(false)
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
    @DisplayName("5. Damaged Item Return: Return 1 damaged packet; verify sellable stock is NOT incremented, quarantined stock incremented")
    void testDamagedItemReturn() {
        InventoryLot lot = inventoryLotRepository.findByBarcode("SYN-VIR-202601").orElseThrow();
        StockInventory dokanStock = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "DOKAN").orElseThrow();
        BigDecimal startDokanQty = dokanStock.getQuantity();

        SaleReturnItemRequest returnItem = SaleReturnItemRequest.builder()
                .lotId(lot.getId())
                .quantity(new BigDecimal("1.000"))
                .refundPrice(new BigDecimal("350.00"))
                .isDamaged(true) // Damaged!
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

        // Quarantine stock MUST be incremented
        StockInventory quarantineStock = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "QUARANTINE").orElseThrow();
        assertThat(quarantineStock.getQuantity()).isEqualByComparingTo("1.000");
    }

    @Test
    @DisplayName("6. Validation: Due adjustment without customer throws BusinessRuleViolationException")
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
                .isInstanceOf(BusinessRuleViolationException.class)
                .hasMessageContaining("Customer is required for DUE_ADJUSTMENT refund");
    }

    @Test
    @DisplayName("7. Query return by ID and Recent Returns list")
    void testQueryReturnMethods() {
        InventoryLot lot = inventoryLotRepository.findByBarcode("SYN-AMI-202502").orElseThrow();

        SaleReturnItemRequest returnItem = SaleReturnItemRequest.builder()
                .lotId(lot.getId())
                .quantity(new BigDecimal("1.000"))
                .refundPrice(new BigDecimal("650.00"))
                .isDamaged(false)
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

    @Test
    @DisplayName("8. Duplicate Customer: Registering duplicate phone throws DuplicateResourceException")
    void testDuplicateCustomerPhoneThrowsException() {
        CustomerRequest request = CustomerRequest.builder()
                .name("রহিম ট্রেডার্স")
                .phone("01711000001") // Seeded customer phone
                .build();

        assertThatThrownBy(() -> customerService.createCustomer(request))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessageContaining("already exists");
    }

    @Test
    @DisplayName("9. Validation: Zero or negative customer payment throws ValidationException")
    void testInvalidPaymentAmountThrowsException() {
        Customer customer = customerRepository.findByPhone("01711000001").orElseThrow();

        CustomerPaymentRequest payment = CustomerPaymentRequest.builder()
                .amount(new BigDecimal("-500.00")) // Invalid amount
                .paymentMethod("CASH")
                .build();

        assertThatThrownBy(() -> customerService.recordPayment(customer.getId(), payment))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("Payment amount must be greater than zero");
    }
}
