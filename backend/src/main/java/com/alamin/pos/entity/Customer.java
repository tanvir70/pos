package com.alamin.pos.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "customer")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Customer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Version
    @Column(name = "version")
    private Long version;

    @Column(name = "name", nullable = false, length = 200)
    private String name;

    @Column(name = "father_name", length = 150)
    private String fatherName;

    @Column(name = "business_name", length = 200)
    private String businessName;

    @Column(name = "phone", nullable = false, length = 50)
    private String phone;

    @Column(name = "whatsapp_number", length = 50)
    private String whatsappNumber;

    @Column(name = "email", length = 100)
    private String email;

    @Column(name = "village_address", length = 255)
    private String villageAddress;

    @Column(name = "customer_type", nullable = false, length = 30)
    private String customerType;

    @Column(name = "credit_limit", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal creditLimit = BigDecimal.ZERO;

    @Column(name = "current_due", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal currentDue = BigDecimal.ZERO;

    @Column(name = "mfs_type", length = 30)
    private String mfsType;

    @Column(name = "mfs_number", length = 50)
    private String mfsNumber;

    @Column(name = "bank_name", length = 100)
    private String bankName;

    @Column(name = "bank_branch", length = 100)
    private String bankBranch;

    @Column(name = "bank_account_no", length = 100)
    private String bankAccountNo;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (creditLimit == null) {
            creditLimit = BigDecimal.ZERO;
        }
        if (currentDue == null) {
            currentDue = BigDecimal.ZERO;
        }
    }
}
