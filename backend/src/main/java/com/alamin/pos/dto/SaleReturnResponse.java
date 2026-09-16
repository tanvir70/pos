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
public class SaleReturnResponse {

    private Long id;
    private String returnNo;
    private Long originalSaleId;
    private Long customerId;
    private String customerName;
    private String customerPhone;
    private LocalDateTime returnDate;
    private BigDecimal totalRefundAmount;
    private String refundType;
    private String reason;
    private List<SaleReturnItemDto> items;
}
