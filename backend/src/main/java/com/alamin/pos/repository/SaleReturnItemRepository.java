package com.alamin.pos.repository;

import com.alamin.pos.entity.SaleReturnItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SaleReturnItemRepository extends JpaRepository<SaleReturnItem, Long> {

    List<SaleReturnItem> findBySaleReturnId(Long saleReturnId);
}
