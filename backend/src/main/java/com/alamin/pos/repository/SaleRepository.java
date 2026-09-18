package com.alamin.pos.repository;

import com.alamin.pos.entity.Sale;
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
public interface SaleRepository extends JpaRepository<Sale, Long> {

    Optional<Sale> findByInvoiceNo(String invoiceNo);

    List<Sale> findByCustomerIdOrderBySaleDateDesc(Long customerId);

    List<Sale> findAllByOrderBySaleDateDesc(Pageable pageable);

    Page<Sale> findAllBy(Pageable pageable);

    Page<Sale> findBySaleDateBetween(LocalDateTime start, LocalDateTime end, Pageable pageable);

    Page<Sale> findBySaleMode(String saleMode, Pageable pageable);

    Page<Sale> findBySaleModeAndSaleDateBetween(String saleMode, LocalDateTime start, LocalDateTime end, Pageable pageable);

    long countBySaleDateBetween(LocalDateTime start, LocalDateTime end);

    List<Sale> findBySaleDateBetween(LocalDateTime start, LocalDateTime end);

    @Query("SELECT COALESCE(SUM(s.totalAmount), 0) FROM Sale s WHERE s.saleDate BETWEEN :start AND :end")
    BigDecimal sumTotalAmountBySaleDateBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT COALESCE(SUM(s.cashPaid), 0) FROM Sale s WHERE s.saleDate BETWEEN :start AND :end")
    BigDecimal sumCashPaidBySaleDateBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT COALESCE(SUM(COALESCE(s.discount, 0) + COALESCE(s.roundOff, 0)), 0) FROM Sale s WHERE s.saleDate BETWEEN :start AND :end")
    BigDecimal sumDiscountsAndRoundOffBySaleDateBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
}
