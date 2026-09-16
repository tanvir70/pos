package com.alamin.pos.service;

import com.alamin.pos.dto.CustomerPaymentRequest;
import com.alamin.pos.dto.CustomerRequest;
import com.alamin.pos.entity.Customer;
import com.alamin.pos.entity.CustomerLedger;
import com.alamin.pos.repository.CustomerLedgerRepository;
import com.alamin.pos.repository.CustomerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class CustomerService {

    private final CustomerRepository customerRepository;
    private final CustomerLedgerRepository customerLedgerRepository;

    @Transactional
    public Customer createCustomer(CustomerRequest request) {
        if (request.getName() == null || request.getName().isBlank()) {
            throw new IllegalArgumentException("Customer name is required");
        }
        if (request.getPhone() == null || request.getPhone().isBlank()) {
            throw new IllegalArgumentException("Phone number is required");
        }

        Optional<Customer> existing = customerRepository.findByPhone(request.getPhone().trim());
        if (existing.isPresent()) {
            throw new IllegalArgumentException("Customer with phone " + request.getPhone() + " already exists");
        }

        String customerType = (request.getCustomerType() != null && !request.getCustomerType().isBlank())
                ? request.getCustomerType().trim().toUpperCase()
                : "RETAIL";

        BigDecimal creditLimit = request.getCreditLimit() != null
                ? request.getCreditLimit().setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

        BigDecimal initialDue = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        if (request.getCurrentDue() != null) {
            initialDue = request.getCurrentDue().setScale(2, RoundingMode.HALF_UP);
        } else if (request.getInitialDue() != null) {
            initialDue = request.getInitialDue().setScale(2, RoundingMode.HALF_UP);
        }

        String whatsapp = (request.getWhatsappNumber() != null && !request.getWhatsappNumber().isBlank())
                ? request.getWhatsappNumber().trim()
                : request.getPhone().trim();

        Customer customer = Customer.builder()
                .name(request.getName().trim())
                .fatherName(request.getFatherName())
                .businessName(request.getBusinessName())
                .phone(request.getPhone().trim())
                .whatsappNumber(whatsapp)
                .email(request.getEmail())
                .villageAddress(request.getVillageAddress())
                .customerType(customerType)
                .creditLimit(creditLimit)
                .currentDue(initialDue)
                .mfsType(request.getMfsType())
                .mfsNumber(request.getMfsNumber())
                .bankName(request.getBankName())
                .bankBranch(request.getBankBranch())
                .bankAccountNo(request.getBankAccountNo())
                .createdAt(LocalDateTime.now())
                .build();

        Customer savedCustomer = customerRepository.save(customer);

        // BUSINESS DECISION: When a new customer profile is registered with an opening due balance, an initial ledger entry is created to establish an immutable audit trail.
        if (initialDue.compareTo(BigDecimal.ZERO) > 0) {
            CustomerLedger openingLedger = CustomerLedger.builder()
                    .customer(savedCustomer)
                    .transactionDate(LocalDateTime.now())
                    .transactionType("INVOICE_BILL")
                    .debit(initialDue)
                    .credit(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP))
                    .balanceAfter(initialDue)
                    .notes("Opening due balance on customer registration")
                    .build();
            customerLedgerRepository.save(openingLedger);
        }

        return savedCustomer;
    }

    @Transactional
    public Customer updateCustomer(Long id, CustomerRequest request) {
        Customer customer = customerRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Customer not found with id: " + id));

        if (request.getName() != null && !request.getName().isBlank()) {
            customer.setName(request.getName().trim());
        }
        if (request.getPhone() != null && !request.getPhone().isBlank() && !request.getPhone().trim().equals(customer.getPhone())) {
            Optional<Customer> existing = customerRepository.findByPhone(request.getPhone().trim());
            if (existing.isPresent() && !existing.get().getId().equals(customer.getId())) {
                throw new IllegalArgumentException("Customer with phone " + request.getPhone() + " already exists");
            }
            customer.setPhone(request.getPhone().trim());
        }

        if (request.getFatherName() != null) {
            customer.setFatherName(request.getFatherName());
        }
        if (request.getBusinessName() != null) {
            customer.setBusinessName(request.getBusinessName());
        }
        if (request.getWhatsappNumber() != null) {
            customer.setWhatsappNumber(request.getWhatsappNumber().trim());
        }
        if (request.getEmail() != null) {
            customer.setEmail(request.getEmail());
        }
        if (request.getVillageAddress() != null) {
            customer.setVillageAddress(request.getVillageAddress());
        }
        if (request.getCustomerType() != null && !request.getCustomerType().isBlank()) {
            customer.setCustomerType(request.getCustomerType().trim().toUpperCase());
        }
        if (request.getCreditLimit() != null) {
            customer.setCreditLimit(request.getCreditLimit().setScale(2, RoundingMode.HALF_UP));
        }
        if (request.getMfsType() != null) {
            customer.setMfsType(request.getMfsType());
        }
        if (request.getMfsNumber() != null) {
            customer.setMfsNumber(request.getMfsNumber());
        }
        if (request.getBankName() != null) {
            customer.setBankName(request.getBankName());
        }
        if (request.getBankBranch() != null) {
            customer.setBankBranch(request.getBankBranch());
        }
        if (request.getBankAccountNo() != null) {
            customer.setBankAccountNo(request.getBankAccountNo());
        }

        // BUSINESS DECISION: Customer profile updates do not directly overwrite currentDue to preserve financial ledger audit integrity; due balance changes occur strictly via sales, repayments, and returns.

        return customerRepository.save(customer);
    }

    @Transactional(readOnly = true)
    public Customer getCustomer(Long id) {
        return customerRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Customer not found with id: " + id));
    }

    @Transactional(readOnly = true)
    public List<Customer> searchCustomers(String query, String customerType) {
        String cleanQuery = (query != null && !query.trim().isBlank()) ? query.trim() : null;
        String cleanType = (customerType != null && !customerType.trim().isBlank()) ? customerType.trim().toUpperCase() : null;

        if (cleanQuery == null && cleanType == null) {
            return customerRepository.findAll();
        }
        return customerRepository.searchCustomers(cleanQuery, cleanType);
    }

    @Transactional
    public CustomerLedger recordPayment(Long customerId, CustomerPaymentRequest request) {
        Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> new IllegalArgumentException("Customer not found with id: " + customerId));

        if (request.getAmount() == null || request.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Payment amount must be greater than zero");
        }

        BigDecimal amount = request.getAmount().setScale(2, RoundingMode.HALF_UP);
        BigDecimal newDue = customer.getCurrentDue().subtract(amount).setScale(2, RoundingMode.HALF_UP);
        customer.setCurrentDue(newDue);
        customerRepository.save(customer);

        // BUSINESS DECISION: Customer due repayments create CASH_PAYMENT ledger entries capturing Money Receipt (MR No.) voucher numbers for audit verification.
        CustomerLedger ledger = CustomerLedger.builder()
                .customer(customer)
                .transactionDate(LocalDateTime.now())
                .transactionType("CASH_PAYMENT")
                .debit(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP))
                .credit(amount)
                .balanceAfter(newDue)
                .moneyReceiptNo(request.getMoneyReceiptNo())
                .notes(request.getNotes())
                .build();

        return customerLedgerRepository.save(ledger);
    }

    @Transactional(readOnly = true)
    public List<CustomerLedger> getCustomerLedger(Long customerId) {
        if (!customerRepository.existsById(customerId)) {
            throw new IllegalArgumentException("Customer not found with id: " + customerId);
        }
        return customerLedgerRepository.findByCustomerIdOrderByTransactionDateDescIdDesc(customerId);
    }
}
