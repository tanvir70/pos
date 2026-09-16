package com.alamin.pos.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SaleResponse {

    private Long id;
    private String invoiceNo;
    private LocalDateTime saleDate;

    // Customer details (null for anonymous walk-in)
    private Long customerId;
    private String customerName;
    private String customerPhone;

    private String saleMode;

    private BigDecimal subtotal;
    private BigDecimal discount;
    private BigDecimal roundOff;
    private BigDecimal totalAmount;

    private String paymentMethod;
    private BigDecimal cashPaid;
    private BigDecimal digitalPaid;
    private String digitalMedium;
    private String digitalTrxId;
    private BigDecimal dueAmount;

    private String cashierName;

    // Total gross profit: sum((unitPrice - unitCost) * totalQuantity) - discount
    private BigDecimal totalProfit;

    private List<SaleItemResponse> items;
}
