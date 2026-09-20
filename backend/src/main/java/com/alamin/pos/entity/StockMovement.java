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
@Table(name = "stock_movement")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StockMovement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lot_id", nullable = false)
    private InventoryLot lot;

    @Column(name = "movement_time", nullable = false)
    private LocalDateTime movementTime;

    @Column(name = "movement_type", nullable = false, length = 40)
    private String movementType;

    @Column(name = "location", nullable = false, length = 20)
    @Builder.Default
    private String location = "DOKAN";

    @Column(name = "quantity_change", nullable = false, precision = 12, scale = 3)
    private BigDecimal quantityChange;

    @Column(name = "balance_before", nullable = false, precision = 12, scale = 3)
    private BigDecimal balanceBefore;

    @Column(name = "balance_after", nullable = false, precision = 12, scale = 3)
    private BigDecimal balanceAfter;

    @Column(name = "unit", nullable = false, length = 30)
    private String unit;

    @Column(name = "reference_doc_no", length = 100)
    private String referenceDocNo;

    @Column(name = "remarks", length = 255)
    private String remarks;

    @Column(name = "performed_by", length = 100)
    private String performedBy;

    @PrePersist
    public void prePersist() {
        if (movementTime == null) {
            movementTime = LocalDateTime.now();
        }
        if (location == null) {
            location = "DOKAN";
        }
    }
}
