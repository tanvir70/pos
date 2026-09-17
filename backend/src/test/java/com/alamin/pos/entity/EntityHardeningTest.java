package com.alamin.pos.entity;

import com.alamin.pos.domain.enums.CustomerType;
import com.alamin.pos.domain.enums.Location;
import com.alamin.pos.domain.enums.PaymentMethod;
import com.alamin.pos.domain.enums.SaleMode;
import com.alamin.pos.domain.enums.TransactionType;
import com.alamin.pos.repository.CustomerRepository;
import com.alamin.pos.repository.IdempotencyRecordRepository;
import com.alamin.pos.repository.ProductRepository;
import com.alamin.pos.repository.SaleRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class EntityHardeningTest {

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private SaleRepository saleRepository;

    @Autowired
    private IdempotencyRecordRepository idempotencyRecordRepository;

    @Test
    @DisplayName("Verify @Version starts at 0 and increments on update")
    void testVersionIncrement() {
        Product product = Product.builder()
                .productCode("TEST-VER-01")
                .nameEn("Test Product")
                .nameBn("টেস্ট প্রোডাক্ট")
                .category("Fungicide")
                .baseUnit("Bottle")
                .standardRetailPrice(new BigDecimal("100.00"))
                .standardWholesalePrice(new BigDecimal("90.00"))
                .build();

        Product saved = productRepository.saveAndFlush(product);
        assertThat(saved.getVersion()).isNotNull().isEqualTo(0L);

        saved.setNameEn("Updated Test Product");
        Product updated = productRepository.saveAndFlush(saved);
        assertThat(updated.getVersion()).isEqualTo(1L);
    }

    @Test
    @DisplayName("Verify Sale entity contains cashTendered and changeAmount")
    void testSaleTenderFields() {
        Sale sale = Sale.builder()
                .invoiceNo("INV-TEST-TENDER-01")
                .saleDate(LocalDateTime.now())
                .saleMode(SaleMode.RETAIL.name())
                .subtotal(new BigDecimal("500.00"))
                .totalAmount(new BigDecimal("500.00"))
                .paymentMethod(PaymentMethod.CASH.name())
                .cashPaid(new BigDecimal("500.00"))
                .cashTendered(new BigDecimal("1000.00"))
                .changeAmount(new BigDecimal("500.00"))
                .build();

        Sale saved = saleRepository.saveAndFlush(sale);
        assertThat(saved.getCashTendered()).isEqualByComparingTo("1000.00");
        assertThat(saved.getChangeAmount()).isEqualByComparingTo("500.00");
        assertThat(saved.getVersion()).isEqualTo(0L);
    }

    @Test
    @DisplayName("Verify IdempotencyRecordRepository persist and retrieve")
    void testIdempotencyRecordPersistence() {
        IdempotencyRecord record = IdempotencyRecord.builder()
                .id("key-abc-123")
                .status("COMPLETED")
                .responseCode(200)
                .responseBody("{\"invoiceNo\":\"INV-9999\"}")
                .build();

        idempotencyRecordRepository.saveAndFlush(record);

        IdempotencyRecord found = idempotencyRecordRepository.findById("key-abc-123").orElse(null);
        assertThat(found).isNotNull();
        assertThat(found.getStatus()).isEqualTo("COMPLETED");
        assertThat(found.getResponseBody()).contains("INV-9999");
    }

    @Test
    @DisplayName("Verify domain enums validation helpers")
    void testDomainEnums() {
        assertThat(Location.isValid("DOKAN")).isTrue();
        assertThat(Location.isValid("quarantine")).isTrue();
        assertThat(Location.isValid("godown")).isFalse();
        assertThat(Location.isValid("INVALID")).isFalse();
        assertThat(CustomerType.valueOf("WHOLESALE")).isEqualTo(CustomerType.WHOLESALE);
        assertThat(TransactionType.valueOf("MFS_PAYMENT")).isEqualTo(TransactionType.MFS_PAYMENT);
    }
}
