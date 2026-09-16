package com.alamin.pos.repository;

import com.alamin.pos.entity.StockInventory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface StockInventoryRepository extends JpaRepository<StockInventory, Long> {

    Optional<StockInventory> findByLotIdAndLocation(Long lotId, String location);

    List<StockInventory> findByLotId(Long lotId);

    @Query("SELECT COALESCE(SUM(si.quantity), 0) FROM StockInventory si WHERE si.lot.product.id = :productId")
    BigDecimal sumQuantityByProductId(@Param("productId") Long productId);
}
