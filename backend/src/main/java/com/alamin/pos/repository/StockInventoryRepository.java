package com.alamin.pos.repository;

import com.alamin.pos.entity.StockInventory;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface StockInventoryRepository extends JpaRepository<StockInventory, Long> {

    Optional<StockInventory> findByLotIdAndLocation(Long lotId, String location);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT si FROM StockInventory si WHERE si.lot.id = :lotId AND si.location = :location")
    Optional<StockInventory> findByLotIdAndLocationForUpdate(@Param("lotId") Long lotId, @Param("location") String location);

    List<StockInventory> findByLotId(Long lotId);

    @Query("SELECT COALESCE(SUM(si.quantity), 0) FROM StockInventory si WHERE si.lot.product.id = :productId")
    BigDecimal sumQuantityByProductId(@Param("productId") Long productId);
}
