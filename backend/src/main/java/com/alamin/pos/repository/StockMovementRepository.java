package com.alamin.pos.repository;

import com.alamin.pos.entity.StockMovement;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StockMovementRepository extends JpaRepository<StockMovement, Long> {

    Page<StockMovement> findAllByOrderByMovementTimeDescIdDesc(Pageable pageable);

    Page<StockMovement> findByProductIdOrderByMovementTimeDescIdDesc(Long productId, Pageable pageable);

    Page<StockMovement> findByLotIdOrderByMovementTimeDescIdDesc(Long lotId, Pageable pageable);

    Page<StockMovement> findByProductIdAndLotIdOrderByMovementTimeDescIdDesc(Long productId, Long lotId, Pageable pageable);

    List<StockMovement> findTop20ByProductIdOrderByMovementTimeDescIdDesc(Long productId);

    @Query("SELECT sm FROM StockMovement sm WHERE (:productId IS NULL OR sm.product.id = :productId) AND (:lotId IS NULL OR sm.lot.id = :lotId) ORDER BY sm.movementTime DESC, sm.id DESC")
    Page<StockMovement> searchMovements(@Param("productId") Long productId, @Param("lotId") Long lotId, Pageable pageable);
}
