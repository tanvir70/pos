package com.alamin.pos.repository;

import com.alamin.pos.entity.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {

    Optional<Product> findByProductCode(String productCode);

    Optional<Product> findByDefaultBarcode(String defaultBarcode);

    List<Product> findByNameEnContainingIgnoreCaseOrNameBnContainingIgnoreCase(String nameEn, String nameBn);

    Page<Product> findByNameEnContainingIgnoreCaseOrNameBnContainingIgnoreCase(String nameEn, String nameBn, Pageable pageable);
}
