package com.alamin.pos.controller;

import com.alamin.pos.dto.CustomerLedgerDto;
import com.alamin.pos.dto.CustomerPaymentRequest;
import com.alamin.pos.dto.CustomerRequest;
import com.alamin.pos.entity.Customer;
import com.alamin.pos.entity.CustomerLedger;
import com.alamin.pos.service.CustomerService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/customers")
@RequiredArgsConstructor
public class CustomerController {

    private final CustomerService customerService;

    @PostMapping
    public ResponseEntity<Customer> createCustomer(@Valid @RequestBody CustomerRequest request) {
        Customer customer = customerService.createCustomer(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(customer);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Customer> updateCustomer(
            @PathVariable Long id,
            @Valid @RequestBody CustomerRequest request) {
        Customer customer = customerService.updateCustomer(id, request);
        return ResponseEntity.ok(customer);
    }

    @GetMapping
    public ResponseEntity<List<Customer>> searchCustomers(
            @RequestParam(name = "query", required = false) String query,
            @RequestParam(name = "type", required = false) String type) {
        return ResponseEntity.ok(customerService.searchCustomers(query, type));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Customer> getCustomer(@PathVariable Long id) {
        return ResponseEntity.ok(customerService.getCustomer(id));
    }

    @GetMapping("/{id}/ledger")
    public ResponseEntity<List<CustomerLedgerDto>> getCustomerLedger(@PathVariable Long id) {
        List<CustomerLedger> ledgers = customerService.getCustomerLedger(id);
        List<CustomerLedgerDto> dtoList = ledgers.stream()
                .map(this::toLedgerDto)
                .toList();
        return ResponseEntity.ok(dtoList);
    }

    @PostMapping("/{id}/payments")
    public ResponseEntity<CustomerLedgerDto> recordPayment(
            @PathVariable Long id,
            @Valid @RequestBody CustomerPaymentRequest request) {
        CustomerLedger ledger = customerService.recordPayment(id, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(toLedgerDto(ledger));
    }

    private CustomerLedgerDto toLedgerDto(CustomerLedger ledger) {
        return CustomerLedgerDto.builder()
                .id(ledger.getId())
                .customerId(ledger.getCustomer() != null ? ledger.getCustomer().getId() : null)
                .customerName(ledger.getCustomer() != null ? ledger.getCustomer().getName() : null)
                .transactionDate(ledger.getTransactionDate())
                .transactionType(ledger.getTransactionType())
                .debit(ledger.getDebit())
                .credit(ledger.getCredit())
                .balanceAfter(ledger.getBalanceAfter())
                .moneyReceiptNo(ledger.getMoneyReceiptNo())
                .saleId(ledger.getSaleId())
                .notes(ledger.getNotes())
                .build();
    }
}
