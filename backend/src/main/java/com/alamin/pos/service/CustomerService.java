package com.alamin.pos.service;

import com.alamin.pos.dto.CustomerPaymentRequest;
import com.alamin.pos.dto.CustomerRequest;
import com.alamin.pos.entity.Customer;
import com.alamin.pos.entity.CustomerLedger;

import java.util.List;

public interface CustomerService {

    Customer createCustomer(CustomerRequest request);

    Customer updateCustomer(Long id, CustomerRequest request);

    Customer getCustomer(Long id);

    List<Customer> searchCustomers(String query, String customerType);

    CustomerLedger recordPayment(Long customerId, CustomerPaymentRequest request);

    List<CustomerLedger> getCustomerLedger(Long customerId);
}
