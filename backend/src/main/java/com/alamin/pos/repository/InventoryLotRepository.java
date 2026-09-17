package com.alamin.pos.repository;

import com.alamin.pos.entity.InventoryLot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface InventoryLotRepository extends JpaRepository<InventoryLot, Long> {

    Optional<InventoryLot> findByBarcode(String barcode);

    Optional<InventoryLot> findByLotNumber(String lotNumber);

    // FEFO: First Expired, First Out dispatch order
    List<InventoryLot> findByProductIdOrderByExpiryDateAsc(Long productId);

    List<InventoryLot> findByProductId(Long productId);

    List<InventoryLot> findAllByOrderByExpiryDateAsc();

    List<InventoryLot> findByExpiryDateLessThanEqualOrderByExpiryDateAsc(LocalDate expiryDate);

    @Query("SELECT l FROM InventoryLot l JOIN FETCH l.product p WHERE l.expiryDate <= :expiryDate ORDER BY l.expiryDate ASC")
    List<InventoryLot> findExpiringLotsWithProduct(@Param("expiryDate") LocalDate expiryDate);

    @Query("SELECT l FROM InventoryLot l JOIN FETCH l.product p")
    List<InventoryLot> findAllWithProduct();
}
