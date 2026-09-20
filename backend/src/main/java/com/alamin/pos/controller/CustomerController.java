package com.alamin.pos.controller;

import com.alamin.pos.dto.CustomerLedgerEntryDto;
import com.alamin.pos.dto.CustomerPaymentRequest;
import com.alamin.pos.dto.CustomerRequest;
import com.alamin.pos.dto.CustomerResponseDto;
import com.alamin.pos.entity.Customer;
import com.alamin.pos.entity.CustomerLedger;
import com.alamin.pos.mapper.CustomerMapper;
import com.alamin.pos.service.CustomerService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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
    private final CustomerMapper customerMapper;
    private final com.alamin.pos.service.DocumentSequenceService documentSequenceService;

    @GetMapping("/next-due-invoice-no")
    public ResponseEntity<java.util.Map<String, String>> getNextDueInvoiceNo() {
        String dueInvoiceNo = documentSequenceService.generateDueReceiptNumber();
        return ResponseEntity.ok(java.util.Map.of("dueInvoiceNo", dueInvoiceNo));
    }

    @PostMapping
    public ResponseEntity<CustomerResponseDto> createCustomer(@Valid @RequestBody CustomerRequest request) {
        Customer customer = customerService.createCustomer(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(customerMapper.toResponseDto(customer));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CustomerResponseDto> updateCustomer(
            @PathVariable Long id,
            @Valid @RequestBody CustomerRequest request) {
        Customer customer = customerService.updateCustomer(id, request);
        return ResponseEntity.ok(customerMapper.toResponseDto(customer));
    }

    @GetMapping
    public ResponseEntity<?> searchCustomers(
            @RequestParam(name = "query", required = false) String query,
            @RequestParam(name = "type", required = false) String type,
            @RequestParam(name = "paged", defaultValue = "false") boolean paged,
            Pageable pageable) {
        if (paged) {
            Page<Customer> page = customerService.searchCustomers(query, type, pageable);
            return ResponseEntity.ok(page.map(customerMapper::toResponseDto));
        }
        return ResponseEntity.ok(customerMapper.toResponseDtoList(customerService.searchCustomers(query, type)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<CustomerResponseDto> getCustomer(@PathVariable Long id) {
        return ResponseEntity.ok(customerMapper.toResponseDto(customerService.getCustomer(id)));
    }

    @GetMapping("/{id}/purchases")
    public ResponseEntity<List<com.alamin.pos.dto.SaleResponse>> getCustomerPurchases(@PathVariable Long id) {
        return ResponseEntity.ok(customerService.getCustomerPurchases(id));
    }

    @GetMapping("/{id}/ledger")
    public ResponseEntity<?> getCustomerLedger(
            @PathVariable Long id,
            @RequestParam(name = "paged", defaultValue = "false") boolean paged,
            Pageable pageable) {
        if (paged) {
            Page<CustomerLedger> page = customerService.getCustomerLedger(id, pageable);
            return ResponseEntity.ok(page.map(customerMapper::toLedgerEntryDto));
        }
        List<CustomerLedger> ledgers = customerService.getCustomerLedger(id);
        return ResponseEntity.ok(customerMapper.toLedgerEntryDtoList(ledgers));
    }

    @PostMapping("/{id}/payments")
    public ResponseEntity<CustomerLedgerEntryDto> recordPayment(
            @PathVariable Long id,
            @Valid @RequestBody CustomerPaymentRequest request) {
        CustomerLedger ledger = customerService.recordPayment(id, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(customerMapper.toLedgerEntryDto(ledger));
    }
}
