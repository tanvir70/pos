package com.alamin.pos.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "sale_return")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SaleReturn {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "return_no", nullable = false, unique = true, length = 50)
    private String returnNo;

    // Optional: direct receipt-less returns common in rural agro shops
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "original_sale_id")
    private Sale originalSale;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id")
    private Customer customer;

    @Column(name = "return_date", nullable = false)
    private LocalDateTime returnDate;

    @Column(name = "total_refund_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalRefundAmount;

    @Column(name = "refund_type", nullable = false, length = 30)
    private String refundType;

    @Column(name = "reason", columnDefinition = "TEXT")
    private String reason;

    @PrePersist
    public void prePersist() {
        if (returnDate == null) {
            returnDate = LocalDateTime.now();
        }
    }
}
