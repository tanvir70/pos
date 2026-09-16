package com.alamin.pos.repository;

import com.alamin.pos.entity.SaleReturn;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SaleReturnRepository extends JpaRepository<SaleReturn, Long> {

    Optional<SaleReturn> findByReturnNo(String returnNo);

    List<SaleReturn> findAllByOrderByReturnDateDesc(Pageable pageable);

    List<SaleReturn> findByCustomerIdOrderByReturnDateDesc(Long customerId);
}

