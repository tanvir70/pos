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
@Table(name = "stock_adjustment")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StockAdjustment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "adjustment_no", nullable = false, unique = true, length = 50)
    private String adjustmentNo;

    @Column(name = "adjustment_date", nullable = false)
    private LocalDateTime adjustmentDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lot_id", nullable = false)
    private InventoryLot lot;

    @Column(name = "adjustment_type", nullable = false, length = 40)
    private String adjustmentType;

    @Column(name = "quantity", nullable = false, precision = 12, scale = 3)
    private BigDecimal quantity;

    @Column(name = "unit", nullable = false, length = 30)
    private String unit;

    @Column(name = "action_type", nullable = false, length = 30)
    private String actionType; // 'SCRAP_DISCARD' or 'MOVE_TO_QUARANTINE'

    @Column(name = "cost_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal costPrice;

    @Column(name = "total_loss_value", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalLossValue;

    @Column(name = "reason", nullable = false, columnDefinition = "TEXT")
    private String reason;

    @Column(name = "performed_by", length = 100)
    private String performedBy;

    @PrePersist
    public void prePersist() {
        if (adjustmentDate == null) {
            adjustmentDate = LocalDateTime.now();
        }
    }
}
