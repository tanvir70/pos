package com.alamin.pos.service;

import com.alamin.pos.dto.InventoryLotDto;
import com.alamin.pos.dto.LotEntryRequest;
import com.alamin.pos.dto.QuarantineDisposalRequest;
import com.alamin.pos.dto.StockItemResponse;
import com.alamin.pos.entity.InventoryLot;
import com.alamin.pos.entity.Product;
import com.alamin.pos.entity.StockInventory;
import com.alamin.pos.exception.InsufficientStockException;
import com.alamin.pos.exception.ValidationException;
import com.alamin.pos.repository.InventoryLotRepository;
import com.alamin.pos.repository.ProductRepository;
import com.alamin.pos.repository.StockInventoryRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Transactional
class InventoryServiceTest {

    @Autowired
    private InventoryService inventoryService;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private InventoryLotRepository inventoryLotRepository;

    @Autowired
    private StockInventoryRepository stockInventoryRepository;

    @Test
    @DisplayName("1. Record lot with 2 cartons (multiplier 20) + 5 loose bottles credits 45 base units to DOKAN store stock")
    void testRecordLotWithCartonConversion() {
        Product product = productRepository.findByProductCode("SYN-AMI-TOP").orElseThrow();
        assertThat(product.getCartonMultiplier()).isEqualByComparingTo("20.000");

        LotEntryRequest request = LotEntryRequest.builder()
                .productId(product.getId())
                .lotNumber("LOT-2026-TEST45")
                .entryDate(LocalDate.now())
                .expiryDate(LocalDate.of(2028, 12, 31))
                .purchaseCost(new BigDecimal("510.00"))
                .lotRetailPrice(new BigDecimal("650.00"))
                .lotWholesalePrice(new BigDecimal("580.00"))
                .quantityCartons(new BigDecimal("2"))
                .quantityBaseUnits(new BigDecimal("5"))
                .supplierName("Agro Chemical Ltd.")
                .challanNo("CH-SYN-TEST-01")
                .build();

        InventoryLot createdLot = inventoryService.recordLotEntry(request);

        assertThat(createdLot).isNotNull();
        assertThat(createdLot.getId()).isNotNull();
        assertThat(createdLot.getLotNumber()).isEqualTo("LOT-2026-TEST45");
        // Verifies auto-generated barcode format SYN-<CODE>-<LOT>
        assertThat(createdLot.getBarcode()).isEqualTo("SYN-AMI-TOP-LOT-2026-TEST45");

        // Verify DOKAN stock inventory has exactly 45 base units (2 * 20 + 5)
        Optional<StockInventory> dokanStock = stockInventoryRepository.findByLotIdAndLocation(createdLot.getId(), "DOKAN");
        assertThat(dokanStock).isPresent();
        assertThat(dokanStock.get().getQuantity()).isEqualByComparingTo("45.000");
    }

    @Test
    @DisplayName("2. Query live stock overview verifies store stock and quarantine stock")
    void testGetStockOverviewCalculatesTotals() {
        List<StockItemResponse> overview = inventoryService.getStockOverview();

        assertThat(overview).isNotEmpty();

        for (StockItemResponse item : overview) {
            assertThat(item.getProductId()).isNotNull();
            assertThat(item.getProductCode()).isNotBlank();
            assertThat(item.getLotId()).isNotNull();
            assertThat(item.getLotNumber()).isNotBlank();
            assertThat(item.getQuantity()).isNotNull();
        }

        // Check seeded lot SYN-AMI-202502: merged to 40.000 in DOKAN
        StockItemResponse seededItem = overview.stream()
                .filter(i -> "SYN-AMI-202502".equals(i.getBarcode()))
                .findFirst()
                .orElseThrow();
        assertThat(seededItem.getQuantity()).isEqualByComparingTo("40.000");
    }

    @Test
    @DisplayName("3. FEFO lot query orders lots strictly by expiryDate ascending")
    void testFefoLotOrdering() {
        Product product = productRepository.findByProductCode("SYN-AMI-TOP").orElseThrow();

        List<InventoryLotDto> fefoLots = inventoryService.getLotsByProduct(product.getId(), true);

        assertThat(fefoLots).hasSizeGreaterThanOrEqualTo(2);

        // Verify chronological ascending order by expiryDate
        for (int i = 0; i < fefoLots.size() - 1; i++) {
            LocalDate currentExpiry = fefoLots.get(i).getExpiryDate();
            LocalDate nextExpiry = fefoLots.get(i + 1).getExpiryDate();
            assertThat(currentExpiry).isBeforeOrEqualTo(nextExpiry);
        }

        // LOT-2025B2 (2027-12-31) must come before LOT-2026A1 (2028-06-30)
        assertThat(fefoLots.get(0).getLotNumber()).isEqualTo("LOT-2025B2");
        assertThat(fefoLots.get(0).getExpiryDate()).isEqualTo(LocalDate.of(2027, 12, 31));
    }

    @Test
    @DisplayName("4. Quarantine stock disposal decreases quarantine balance and throws InsufficientStockException on overdraw")
    void testQuarantineStockDisposal() {
        InventoryLot lot = inventoryLotRepository.findByBarcode("SYN-AMI-202502").orElseThrow();

        // Seed quarantine stock for this lot
        stockInventoryRepository.save(StockInventory.builder()
                .lot(lot)
                .location("QUARANTINE")
                .quantity(new BigDecimal("10.000"))
                .build());

        QuarantineDisposalRequest request = QuarantineDisposalRequest.builder()
                .lotId(lot.getId())
                .quantity(new BigDecimal("4.000"))
                .disposalType("SUPPLIER_CLAIM")
                .remarks("Defective seal returned to supplier")
                .build();

        inventoryService.disposeQuarantineStock(request);

        StockInventory remaining = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "QUARANTINE").orElseThrow();
        assertThat(remaining.getQuantity()).isEqualByComparingTo("6.000");

        // Attempting to dispose more than 6.000 throws InsufficientStockException
        QuarantineDisposalRequest overdraw = QuarantineDisposalRequest.builder()
                .lotId(lot.getId())
                .quantity(new BigDecimal("10.000"))
                .disposalType("WRITE_OFF")
                .build();

        assertThatThrownBy(() -> inventoryService.disposeQuarantineStock(overdraw))
                .isInstanceOf(InsufficientStockException.class)
                .hasMessageContaining("exceeds available quarantine stock");
    }

    @Test
    @DisplayName("5. Zero total quantity lot entry throws ValidationException")
    void testZeroQuantityLotEntryThrowsException() {
        Product product = productRepository.findByProductCode("SYN-AMI-TOP").orElseThrow();

        LotEntryRequest zeroLot = LotEntryRequest.builder()
                .productId(product.getId())
                .lotNumber("LOT-ZERO")
                .expiryDate(LocalDate.now().plusYears(1))
                .purchaseCost(BigDecimal.TEN)
                .lotRetailPrice(BigDecimal.TEN)
                .lotWholesalePrice(BigDecimal.TEN)
                .quantityCartons(BigDecimal.ZERO)
                .quantityBaseUnits(BigDecimal.ZERO)
                .build();

        assertThatThrownBy(() -> inventoryService.recordLotEntry(zeroLot))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("Total quantity must be greater than zero");
    }
}
