package com.alamin.pos.repository;

import com.alamin.pos.entity.Sale;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

@Repository
public interface SaleRepository extends JpaRepository<Sale, Long> {

    Optional<Sale> findByInvoiceNo(String invoiceNo);

    List<Sale> findByCustomerIdOrderBySaleDateDesc(Long customerId);

    List<Sale> findAllByOrderBySaleDateDesc(Pageable pageable);
}
