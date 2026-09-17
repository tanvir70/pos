package com.alamin.pos.service.impl;

import com.alamin.pos.dto.CustomerPaymentRequest;
import com.alamin.pos.dto.CustomerRequest;
import com.alamin.pos.entity.Customer;
import com.alamin.pos.entity.CustomerLedger;
import com.alamin.pos.exception.DuplicateResourceException;
import com.alamin.pos.exception.ResourceNotFoundException;
import com.alamin.pos.exception.ValidationException;
import com.alamin.pos.repository.CustomerLedgerRepository;
import com.alamin.pos.repository.CustomerRepository;
import com.alamin.pos.service.CustomerService;
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
public class CustomerServiceImpl implements CustomerService {

    private final CustomerRepository customerRepository;
    private final CustomerLedgerRepository customerLedgerRepository;

    @Override
    @Transactional
    public Customer createCustomer(CustomerRequest request) {
        if (request.getName() == null || request.getName().isBlank()) {
            throw new ValidationException("Customer name is required");
        }
        if (request.getPhone() == null || request.getPhone().isBlank()) {
            throw new ValidationException("Phone number is required");
        }

        Optional<Customer> existing = customerRepository.findByPhone(request.getPhone().trim());
        if (existing.isPresent()) {
            throw new DuplicateResourceException("Customer with phone " + request.getPhone() + " already exists");
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

    @Override
    @Transactional
    public Customer updateCustomer(Long id, CustomerRequest request) {
        Customer customer = customerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found with id: " + id));

        if (request.getName() != null && !request.getName().isBlank()) {
            customer.setName(request.getName().trim());
        }
        if (request.getPhone() != null && !request.getPhone().isBlank() && !request.getPhone().trim().equals(customer.getPhone())) {
            Optional<Customer> existing = customerRepository.findByPhone(request.getPhone().trim());
            if (existing.isPresent() && !existing.get().getId().equals(customer.getId())) {
                throw new DuplicateResourceException("Customer with phone " + request.getPhone() + " already exists");
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
            customer.setEmail(request.getEmail().trim());
        }
        if (request.getVillageAddress() != null) {
            customer.setVillageAddress(request.getVillageAddress().trim());
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
            customer.setMfsNumber(request.getMfsNumber().trim());
        }
        if (request.getBankName() != null) {
            customer.setBankName(request.getBankName().trim());
        }
        if (request.getBankBranch() != null) {
            customer.setBankBranch(request.getBankBranch().trim());
        }
        if (request.getBankAccountNo() != null) {
            customer.setBankAccountNo(request.getBankAccountNo().trim());
        }

        // BUSINESS DECISION: Customer profile updates do not directly overwrite currentDue to preserve financial ledger audit integrity; due balance changes occur strictly via sales, repayments, and returns.

        return customerRepository.save(customer);
    }

    @Override
    @Transactional(readOnly = true)
    public Customer getCustomer(Long id) {
        return customerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found with id: " + id));
    }

    @Override
    @Transactional(readOnly = true)
    public List<Customer> searchCustomers(String query, String customerType) {
        String cleanQuery = (query != null && !query.trim().isBlank()) ? query.trim() : null;
        String cleanType = (customerType != null && !customerType.trim().isBlank()) ? customerType.trim().toUpperCase() : null;

        if (cleanQuery == null && cleanType == null) {
            return customerRepository.findAll();
        }
        return customerRepository.searchCustomers(cleanQuery, cleanType);
    }

    @Override
    @Transactional
    public CustomerLedger recordPayment(Long customerId, CustomerPaymentRequest request) {
        Customer customer = customerRepository.findByIdForUpdate(customerId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found with id: " + customerId));

        if (request.getAmount() == null || request.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new ValidationException("Payment amount must be greater than zero");
        }

        BigDecimal amount = request.getAmount().setScale(2, RoundingMode.HALF_UP);
        BigDecimal newDue = customer.getCurrentDue().subtract(amount).setScale(2, RoundingMode.HALF_UP);
        customer.setCurrentDue(newDue);
        customerRepository.save(customer);

        String method = request.getPaymentMethod() != null ? request.getPaymentMethod().trim().toUpperCase() : "CASH";
        String trxType;
        if ("BKASH".equals(method) || "NAGAD".equals(method) || "MFS".equals(method)) {
            trxType = "MFS_PAYMENT";
        } else if ("BANK_TRANSFER".equals(method) || "BANK".equals(method)) {
            trxType = "BANK_TRANSFER";
        } else {
            trxType = "CASH_PAYMENT";
        }

        CustomerLedger ledger = CustomerLedger.builder()
                .customer(customer)
                .transactionDate(LocalDateTime.now())
                .transactionType(trxType)
                .debit(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP))
                .credit(amount)
                .balanceAfter(newDue)
                .moneyReceiptNo(request.getMoneyReceiptNo())
                .notes(request.getNotes())
                .build();

        return customerLedgerRepository.save(ledger);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CustomerLedger> getCustomerLedger(Long customerId) {
        if (!customerRepository.existsById(customerId)) {
            throw new ResourceNotFoundException("Customer not found with id: " + customerId);
        }
        return customerLedgerRepository.findByCustomerIdOrderByTransactionDateDescIdDesc(customerId);
    }

    @Override
    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<Customer> searchCustomers(String query, String customerType, org.springframework.data.domain.Pageable pageable) {
        String cleanQuery = (query != null && !query.trim().isBlank()) ? query.trim() : null;
        String cleanType = (customerType != null && !customerType.trim().isBlank()) ? customerType.trim().toUpperCase() : null;
        if (cleanQuery == null && cleanType == null) {
            return customerRepository.findAll(pageable);
        }
        return customerRepository.searchCustomers(cleanQuery, cleanType, pageable);
    }

    @Override
    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<CustomerLedger> getCustomerLedger(Long customerId, org.springframework.data.domain.Pageable pageable) {
        if (!customerRepository.existsById(customerId)) {
            throw new ResourceNotFoundException("Customer not found with id: " + customerId);
        }
        return customerLedgerRepository.findByCustomerIdOrderByTransactionDateDescIdDesc(customerId, pageable);
    }
}

