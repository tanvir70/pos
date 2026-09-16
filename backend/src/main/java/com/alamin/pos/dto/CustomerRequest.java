package com.alamin.pos.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CustomerRequest {

    @NotBlank(message = "Customer name is required")
    private String name;

    private String fatherName;
    private String businessName;

    @NotBlank(message = "Phone number is required")
    private String phone;

    private String whatsappNumber;
    private String email;
    private String villageAddress;

    // 'WHOLESALE' or 'RETAIL'
    private String customerType;

    private BigDecimal creditLimit;
    private BigDecimal currentDue;
    private BigDecimal initialDue;

    private String mfsType;
    private String mfsNumber;
    private String bankName;
    private String bankBranch;
    private String bankAccountNo;
}
