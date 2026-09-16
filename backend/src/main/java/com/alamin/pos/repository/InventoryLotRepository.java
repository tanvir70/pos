package com.alamin.pos.repository;

import com.alamin.pos.entity.InventoryLot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InventoryLotRepository extends JpaRepository<InventoryLot, Long> {

    Optional<InventoryLot> findByBarcode(String barcode);

    // FEFO: First Expired, First Out dispatch order
    List<InventoryLot> findByProductIdOrderByExpiryDateAsc(Long productId);

    List<InventoryLot> findByProductId(Long productId);

    List<InventoryLot> findAllByOrderByExpiryDateAsc();
}

