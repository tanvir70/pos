package com.alamin.pos.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProductDto {
    private Long id;

    @NotBlank(message = "Product code is required")
    private String productCode;

    @NotBlank(message = "English name is required")
    private String nameEn;

    @NotBlank(message = "Bengali name is required")
    private String nameBn;

    private String companyName;
    private String category;
    private String baseUnit;

    @DecimalMin(value = "0.001", message = "Carton multiplier must be greater than zero")
    private BigDecimal cartonMultiplier;

    private String defaultBarcode;

    @NotNull(message = "Standard retail price is required")
    @DecimalMin(value = "0.01", message = "Standard retail price must be positive")
    private BigDecimal standardRetailPrice;

    @DecimalMin(value = "0.01", message = "Standard wholesale price must be positive")
    private BigDecimal standardWholesalePrice;

    private Integer minStockAlert;
    private String imagePath;
    private LocalDateTime createdAt;
}
