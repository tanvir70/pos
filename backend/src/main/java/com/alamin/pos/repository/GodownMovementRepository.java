package com.alamin.pos.repository;

import com.alamin.pos.entity.GodownMovement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GodownMovementRepository extends JpaRepository<GodownMovement, Long> {

    List<GodownMovement> findByLotIdOrderByMovementDateDesc(Long lotId);
}
