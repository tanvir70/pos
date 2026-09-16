package com.alamin.pos.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LotEntryRequest {

    @NotNull(message = "Product ID is required")
    private Long productId;

    @NotBlank(message = "Lot number is required")
    private String lotNumber;

    private LocalDate entryDate;

    @NotNull(message = "Expiry date is required")
    private LocalDate expiryDate;

    @NotNull(message = "Purchase cost is required")
    private BigDecimal purchaseCost;

    @NotNull(message = "Lot retail price is required")
    private BigDecimal lotRetailPrice;

    @NotNull(message = "Lot wholesale price is required")
    private BigDecimal lotWholesalePrice;

    private String barcode;

    private String supplierName;

    private String challanNo;

    private BigDecimal quantityCartons;

    private BigDecimal quantityBaseUnits;

    private String location;
}
