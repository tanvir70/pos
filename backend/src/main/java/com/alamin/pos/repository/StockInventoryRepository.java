package com.alamin.pos.repository;

import com.alamin.pos.entity.StockInventory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StockInventoryRepository extends JpaRepository<StockInventory, Long> {

    Optional<StockInventory> findByLotIdAndLocation(Long lotId, String location);

    List<StockInventory> findByLotId(Long lotId);
}
