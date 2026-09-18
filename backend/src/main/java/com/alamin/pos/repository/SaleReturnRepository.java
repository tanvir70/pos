package com.alamin.pos.repository;

import com.alamin.pos.entity.SaleReturn;
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
public interface SaleReturnRepository extends JpaRepository<SaleReturn, Long> {

    Optional<SaleReturn> findByReturnNo(String returnNo);

    List<SaleReturn> findAllByOrderByReturnDateDesc(Pageable pageable);

    List<SaleReturn> findByCustomerIdOrderByReturnDateDesc(Long customerId);

    List<SaleReturn> findByOriginalSaleId(Long originalSaleId);

    List<SaleReturn> findByReturnDateBetweenAndRefundType(LocalDateTime start, LocalDateTime end, String refundType);

    @Query("SELECT COALESCE(SUM(sr.totalRefundAmount), 0) FROM SaleReturn sr WHERE sr.returnDate BETWEEN :start AND :end AND sr.refundType = :refundType")
    BigDecimal sumRefundAmountByDateBetweenAndRefundType(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end, @Param("refundType") String refundType);

    @Query("SELECT COALESCE(SUM(sr.totalRefundAmount), 0) FROM SaleReturn sr WHERE sr.returnDate BETWEEN :start AND :end")
    BigDecimal sumTotalRefundAmountByDateBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
}
