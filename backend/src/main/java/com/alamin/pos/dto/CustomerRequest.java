package com.alamin.pos.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
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
    @Pattern(regexp = "^01[3-9]\\d{8}$", message = "Invalid Bangladesh phone number")
    private String phone;

    private String whatsappNumber;
    private String email;
    private String villageAddress;

    // 'WHOLESALE' or 'RETAIL'
    private String customerType;

    private BigDecimal currentDue;
    private BigDecimal initialDue;

    private String mfsType;
    private String mfsNumber;
    private String bankName;
    private String bankBranch;
    private String bankAccountNo;
}
