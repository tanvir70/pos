package com.alamin.pos.repository;

import com.alamin.pos.entity.StockAdjustment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface StockAdjustmentRepository extends JpaRepository<StockAdjustment, Long> {

    Optional<StockAdjustment> findByAdjustmentNo(String adjustmentNo);

    Page<StockAdjustment> findAllByOrderByAdjustmentDateDescIdDesc(Pageable pageable);

    Page<StockAdjustment> findByProductIdOrderByAdjustmentDateDescIdDesc(Long productId, Pageable pageable);
}
