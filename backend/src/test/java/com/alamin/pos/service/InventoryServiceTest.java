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
import com.alamin.pos.dto.PagedResponse;
import com.alamin.pos.dto.StockAdjustmentRequest;
import com.alamin.pos.dto.StockAdjustmentResponse;
import com.alamin.pos.dto.StockMovementDto;
import com.alamin.pos.dto.StockValuationSummaryDto;
import com.alamin.pos.entity.StockAdjustment;
import com.alamin.pos.entity.StockMovement;
import com.alamin.pos.repository.StockAdjustmentRepository;
import com.alamin.pos.repository.StockMovementRepository;
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

    @Autowired
    private StockMovementRepository stockMovementRepository;

    @Autowired
    private StockAdjustmentRepository stockAdjustmentRepository;

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
    @DisplayName("2b. In-stock only query excludes zero stock items and loads active lots")
    void testGetStockOverviewInStockOnlyFilter() {
        List<StockItemResponse> inStockOverview = inventoryService.getStockOverview(true);

        assertThat(inStockOverview).isNotEmpty();
        for (StockItemResponse item : inStockOverview) {
            assertThat(item.getQuantity()).isGreaterThan(java.math.BigDecimal.ZERO);
            assertThat(item.getProductId()).isNotNull();
            assertThat(item.getProductCode()).isNotBlank();
        }
    }

    @Test
    @DisplayName("3. Seed lot query returns the default operational lot")
    void testFefoLotOrdering() {
        Product product = productRepository.findByProductCode("SYN-AMI-TOP").orElseThrow();

        List<InventoryLotDto> fefoLots = inventoryService.getLotsByProduct(product.getId(), true);

        assertThat(fefoLots).hasSizeGreaterThanOrEqualTo(2);
        assertThat(fefoLots.get(0).getLotNumber()).isEqualTo("DEFAULT");
        assertThat(fefoLots.get(0).getExpiryDate()).isEqualTo(LocalDate.of(2030, 12, 31));
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

    @Test
    @DisplayName("6. Stock adjustment with SCRAP_DISCARD reduces Dokan stock and logs immutable bin card movement")
    void testRecordStockAdjustmentDirectScrap() {
        Product product = productRepository.findByProductCode("SYN-AMI-TOP").orElseThrow();
        InventoryLot lot = inventoryLotRepository.findByProductId(product.getId()).get(0);
        StockInventory dokanStock = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "DOKAN").orElseThrow();
        BigDecimal initialQty = dokanStock.getQuantity();

        StockAdjustmentRequest request = StockAdjustmentRequest.builder()
                .productId(product.getId())
                .lotId(lot.getId())
                .adjustmentType("BREAKAGE_LEAKAGE")
                .quantity(new BigDecimal("2.000"))
                .actionType("SCRAP_DISCARD")
                .reason("Bottle cracked during shelf restocking")
                .performedBy("Admin")
                .build();

        StockAdjustmentResponse response = inventoryService.recordStockAdjustment(request);

        assertThat(response.getAdjustmentNo()).startsWith("ADJ-");
        assertThat(response.getQuantity()).isEqualByComparingTo("2.000");
        assertThat(response.getTotalLossValue()).isEqualByComparingTo(lot.getPurchaseCost().multiply(new BigDecimal("2.000")));

        StockInventory updatedStock = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "DOKAN").orElseThrow();
        assertThat(updatedStock.getQuantity()).isEqualByComparingTo(initialQty.subtract(new BigDecimal("2.000")));

        // Verify Bin Card Movement
        PagedResponse<StockMovementDto> movements = inventoryService.getStockMovements(product.getId(), lot.getId(), 0, 10);
        assertThat(movements.getContent()).isNotEmpty();
        StockMovementDto latest = movements.getContent().get(0);
        assertThat(latest.getMovementType()).isEqualTo("BREAKAGE_LEAKAGE");
        assertThat(latest.getQuantityChange()).isEqualByComparingTo("-2.000");
        assertThat(latest.getBalanceAfter()).isEqualByComparingTo(updatedStock.getQuantity());
        assertThat(latest.getReferenceDocNo()).isEqualTo(response.getAdjustmentNo());
    }

    @Test
    @DisplayName("7. Stock adjustment with MOVE_TO_QUARANTINE moves stock to Quarantine and logs dual movements")
    void testRecordStockAdjustmentMoveToQuarantine() {
        Product product = productRepository.findByProductCode("SYN-VIR-40WG").orElseThrow();
        InventoryLot lot = inventoryLotRepository.findByProductId(product.getId()).get(0);
        StockInventory dokanStock = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "DOKAN").orElseThrow();
        BigDecimal initialDokanQty = dokanStock.getQuantity();

        StockAdjustmentRequest request = StockAdjustmentRequest.builder()
                .productId(product.getId())
                .lotId(lot.getId())
                .adjustmentType("EXPIRED_SCRAP")
                .quantity(new BigDecimal("3.000"))
                .actionType("MOVE_TO_QUARANTINE")
                .reason("Near-expiry batch moved to safe quarantine holding")
                .performedBy("Admin")
                .build();

        StockAdjustmentResponse response = inventoryService.recordStockAdjustment(request);
        assertThat(response.getActionType()).isEqualTo("MOVE_TO_QUARANTINE");

        StockInventory updatedDokan = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "DOKAN").orElseThrow();
        assertThat(updatedDokan.getQuantity()).isEqualByComparingTo(initialDokanQty.subtract(new BigDecimal("3.000")));

        StockInventory quarantineStock = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "QUARANTINE").orElseThrow();
        assertThat(quarantineStock.getQuantity()).isGreaterThanOrEqualTo(new BigDecimal("3.000"));
    }

    @Test
    @DisplayName("8. Stock valuation summary accurately computes total cost, retail, wholesale, and potential profit")
    void testStockValuationSummary() {
        StockValuationSummaryDto valuation = inventoryService.getStockValuationSummary();

        assertThat(valuation).isNotNull();
        assertThat(valuation.getTotalCostValuation()).isGreaterThan(BigDecimal.ZERO);
        assertThat(valuation.getTotalRetailValuation()).isGreaterThan(valuation.getTotalCostValuation());
        assertThat(valuation.getPotentialGrossProfit()).isEqualByComparingTo(
                valuation.getTotalRetailValuation().subtract(valuation.getTotalCostValuation())
        );
        assertThat(valuation.getTotalActiveLots()).isGreaterThan(0L);
        assertThat(valuation.getTotalProductsInStock()).isGreaterThan(0L);
        assertThat(valuation.getTotalUnitsInStock()).isGreaterThan(BigDecimal.ZERO);
    }
}
