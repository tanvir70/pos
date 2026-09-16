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
@Table(name = "sale")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Sale {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "invoice_no", nullable = false, unique = true, length = 50)
    private String invoiceNo;

    @Column(name = "sale_date", nullable = false)
    private LocalDateTime saleDate;

    // Optional customer for walk-in cash retail customers
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id")
    private Customer customer;

    @Column(name = "sale_mode", nullable = false, length = 20)
    private String saleMode;

    @Column(name = "subtotal", nullable = false, precision = 12, scale = 2)
    private BigDecimal subtotal;

    @Column(name = "discount", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal discount = BigDecimal.ZERO;

    @Column(name = "round_off", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal roundOff = BigDecimal.ZERO;

    @Column(name = "total_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount;

    @Column(name = "payment_method", nullable = false, length = 30)
    @Builder.Default
    private String paymentMethod = "CASH";

    @Column(name = "cash_paid", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal cashPaid = BigDecimal.ZERO;

    @Column(name = "digital_paid", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal digitalPaid = BigDecimal.ZERO;

    @Column(name = "digital_medium", length = 30)
    private String digitalMedium;

    @Column(name = "digital_trx_id", length = 100)
    private String digitalTrxId;

    @Column(name = "due_amount", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal dueAmount = BigDecimal.ZERO;

    @Column(name = "cashier_name", length = 100)
    private String cashierName;

    @PrePersist
    public void prePersist() {
        if (saleDate == null) {
            saleDate = LocalDateTime.now();
        }
        if (discount == null) {
            discount = BigDecimal.ZERO;
        }
        if (roundOff == null) {
            roundOff = BigDecimal.ZERO;
        }
        if (paymentMethod == null) {
            paymentMethod = "CASH";
        }
        if (cashPaid == null) {
            cashPaid = BigDecimal.ZERO;
        }
        if (digitalPaid == null) {
            digitalPaid = BigDecimal.ZERO;
        }
        if (dueAmount == null) {
            dueAmount = BigDecimal.ZERO;
        }
    }
}
