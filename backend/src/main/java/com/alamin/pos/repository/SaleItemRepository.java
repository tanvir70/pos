package com.alamin.pos.repository;

import com.alamin.pos.dto.TopSellingProductDto;
import com.alamin.pos.entity.SaleItem;
import org.springframework.data.domain.Pageable;
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

    @Query("SELECT si FROM SaleItem si LEFT JOIN FETCH si.lot l LEFT JOIN FETCH l.product p WHERE si.sale.id IN :saleIds")
    List<SaleItem> findBySaleIdInWithLotAndProduct(@Param("saleIds") Collection<Long> saleIds);

    @Query("SELECT COALESCE(SUM((si.unitPrice - si.unitCost) * si.totalQuantity), 0) FROM SaleItem si WHERE si.sale.saleDate BETWEEN :start AND :end")
    BigDecimal sumLineProfitBySaleDateBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT new com.alamin.pos.dto.TopSellingProductDto(p.id, p.productCode, p.nameEn, p.nameBn, p.baseUnit, SUM(si.totalQuantity), SUM(si.subtotal), 0.0) " +
           "FROM SaleItem si JOIN si.lot l JOIN l.product p JOIN si.sale s " +
           "WHERE s.saleDate >= :startDate " +
           "GROUP BY p.id, p.productCode, p.nameEn, p.nameBn, p.baseUnit " +
           "ORDER BY SUM(si.totalQuantity) DESC")
    List<TopSellingProductDto> findTopSellingProducts(@Param("startDate") LocalDateTime startDate, Pageable pageable);

    @Query("SELECT new com.alamin.pos.dto.TopSellingProductDto(p.id, p.productCode, p.nameEn, p.nameBn, p.baseUnit, SUM(si.totalQuantity), SUM(si.subtotal), 0.0) " +
           "FROM SaleItem si JOIN si.lot l JOIN l.product p " +
           "GROUP BY p.id, p.productCode, p.nameEn, p.nameBn, p.baseUnit " +
           "ORDER BY SUM(si.totalQuantity) DESC")
    List<TopSellingProductDto> findAllTimeTopSellingProducts(Pageable pageable);
}
