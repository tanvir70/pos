package com.alamin.pos.service;

import com.alamin.pos.dto.CustomerPaymentRequest;
import com.alamin.pos.dto.CustomerRequest;
import com.alamin.pos.entity.Customer;
import com.alamin.pos.entity.CustomerLedger;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface CustomerService {

    Customer createCustomer(CustomerRequest request);

    Customer updateCustomer(Long id, CustomerRequest request);

    Customer getCustomer(Long id);

    List<Customer> searchCustomers(String query, String customerType);

    Page<Customer> searchCustomers(String query, String customerType, Pageable pageable);

    CustomerLedger recordPayment(Long customerId, CustomerPaymentRequest request);

    List<CustomerLedger> getCustomerLedger(Long customerId);

    Page<CustomerLedger> getCustomerLedger(Long customerId, Pageable pageable);
}
