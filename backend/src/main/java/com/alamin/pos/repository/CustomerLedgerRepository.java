package com.alamin.pos.repository;

import com.alamin.pos.entity.CustomerLedger;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface CustomerLedgerRepository extends JpaRepository<CustomerLedger, Long> {

    List<CustomerLedger> findByCustomerIdOrderByTransactionDateDesc(Long customerId);

    List<CustomerLedger> findByCustomerIdOrderByTransactionDateDescIdDesc(Long customerId);

    Page<CustomerLedger> findByCustomerIdOrderByTransactionDateDescIdDesc(Long customerId, Pageable pageable);

    Optional<CustomerLedger> findTopByCustomerIdOrderByTransactionDateDescIdDesc(Long customerId);

    List<CustomerLedger> findByTransactionDateBetweenAndTransactionType(LocalDateTime start, LocalDateTime end, String transactionType);

    @Query("SELECT COALESCE(SUM(cl.credit), 0) FROM CustomerLedger cl WHERE cl.transactionDate BETWEEN :start AND :end AND cl.transactionType = :type")
    BigDecimal sumCreditByDateBetweenAndTransactionType(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end, @Param("type") String transactionType);
}
