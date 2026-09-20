package com.alamin.pos.dto;

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
public class CustomerResponseDto {
    private Long id;
    private String name;
    private String fatherName;
    private String businessName;
    private String phone;
    private String whatsappNumber;
    private String email;
    private String villageAddress;
    private String customerType;
    private BigDecimal totalPurchases;
    private BigDecimal currentDue;
    private String mfsType;
    private String mfsNumber;
    private String bankName;
    private String bankBranch;
    private String bankAccountNo;
    private LocalDateTime createdAt;
}
