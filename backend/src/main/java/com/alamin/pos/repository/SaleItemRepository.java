package com.alamin.pos.repository;

import com.alamin.pos.entity.SaleItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

@Repository
public interface SaleItemRepository extends JpaRepository<SaleItem, Long> {

    List<SaleItem> findBySaleId(Long saleId);

    List<SaleItem> findBySaleIdIn(Collection<Long> saleIds);

    @Query("SELECT COALESCE(SUM((si.unitPrice - si.unitCost) * si.totalQuantity), 0) FROM SaleItem si WHERE si.sale.saleDate BETWEEN :start AND :end")
    BigDecimal sumLineProfitBySaleDateBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
}
