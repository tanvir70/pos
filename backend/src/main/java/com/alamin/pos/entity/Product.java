package com.alamin.pos.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
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
@Table(name = "product")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "product_code", nullable = false, unique = true, length = 50)
    private String productCode;

    @Column(name = "name_en", nullable = false, length = 255)
    private String nameEn;

    @Column(name = "name_bn", nullable = false, length = 255)
    private String nameBn;

    @Column(name = "company_name", length = 150)
    @Builder.Default
    private String companyName = "Syngenta";

    @Column(name = "category", nullable = false, length = 100)
    private String category;

    @Column(name = "base_unit", nullable = false, length = 30)
    private String baseUnit;

    @Column(name = "carton_multiplier", precision = 10, scale = 3)
    @Builder.Default
    private BigDecimal cartonMultiplier = BigDecimal.ONE;

    @Column(name = "default_barcode", length = 100)
    private String defaultBarcode;

    @Column(name = "standard_retail_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal standardRetailPrice;

    @Column(name = "standard_wholesale_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal standardWholesalePrice;

    @Column(name = "min_stock_alert")
    @Builder.Default
    private Integer minStockAlert = 5;

    @Column(name = "image_path", length = 500)
    private String imagePath;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (cartonMultiplier == null) {
            cartonMultiplier = BigDecimal.ONE;
        }
        if (companyName == null) {
            companyName = "Syngenta";
        }
        if (minStockAlert == null) {
            minStockAlert = 5;
        }
    }
}
