package com.alamin.pos.repository;

import com.alamin.pos.entity.CustomerLedger;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface CustomerLedgerRepository extends JpaRepository<CustomerLedger, Long> {

    List<CustomerLedger> findByCustomerIdOrderByTransactionDateDesc(Long customerId);

    List<CustomerLedger> findByCustomerIdOrderByTransactionDateDescIdDesc(Long customerId);

    Optional<CustomerLedger> findTopByCustomerIdOrderByTransactionDateDescIdDesc(Long customerId);

    List<CustomerLedger> findByTransactionDateBetweenAndTransactionType(LocalDateTime start, LocalDateTime end, String transactionType);
}

