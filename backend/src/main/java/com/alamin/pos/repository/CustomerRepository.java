package com.alamin.pos.repository;

import com.alamin.pos.entity.Customer;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface CustomerRepository extends JpaRepository<Customer, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM Customer c WHERE c.id = :id")
    Optional<Customer> findByIdForUpdate(@Param("id") Long id);

    Optional<Customer> findByPhone(String phone);

    List<Customer> findByNameContainingIgnoreCaseOrPhoneContaining(String name, String phone);

    List<Customer> findByCustomerType(String customerType);

    @Query("SELECT c FROM Customer c WHERE " +
            "(:query IS NULL OR LOWER(c.name) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "OR LOWER(c.phone) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "OR (c.businessName IS NOT NULL AND LOWER(c.businessName) LIKE LOWER(CONCAT('%', :query, '%')))) " +
            "AND (:customerType IS NULL OR UPPER(c.customerType) = UPPER(:customerType))")
    List<Customer> searchCustomers(@Param("query") String query, @Param("customerType") String customerType);

    @Query("SELECT c FROM Customer c WHERE " +
            "(:query IS NULL OR LOWER(c.name) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "OR LOWER(c.phone) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "OR (c.businessName IS NOT NULL AND LOWER(c.businessName) LIKE LOWER(CONCAT('%', :query, '%')))) " +
            "AND (:customerType IS NULL OR UPPER(c.customerType) = UPPER(:customerType))")
    Page<Customer> searchCustomers(@Param("query") String query, @Param("customerType") String customerType, Pageable pageable);

    @Query("SELECT COALESCE(SUM(c.currentDue), 0) FROM Customer c WHERE c.currentDue > 0")
    BigDecimal sumTotalMarketDue();
}
