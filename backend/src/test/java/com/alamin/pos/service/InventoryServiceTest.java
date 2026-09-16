package com.alamin.pos.service;

import com.alamin.pos.dto.InventoryLotDto;
import com.alamin.pos.dto.LotEntryRequest;
import com.alamin.pos.dto.StockItemResponse;
import com.alamin.pos.dto.StockTransferRequest;
import com.alamin.pos.entity.GodownMovement;
import com.alamin.pos.entity.InventoryLot;
import com.alamin.pos.entity.Product;
import com.alamin.pos.entity.StockInventory;
import com.alamin.pos.repository.GodownMovementRepository;
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

    @Autowired
    private GodownMovementRepository godownMovementRepository;

    @Test
    @DisplayName("1. Record lot with 2 cartons (multiplier 20) + 5 loose bottles credits 45 base units to GODOWN and logs movement")
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
                .location("GODOWN")
                .supplierName("Syngenta Bangladesh Ltd.")
                .challanNo("CH-SYN-TEST-01")
                .build();

        InventoryLot createdLot = inventoryService.recordLotEntry(request);

        assertThat(createdLot).isNotNull();
        assertThat(createdLot.getId()).isNotNull();
        assertThat(createdLot.getLotNumber()).isEqualTo("LOT-2026-TEST45");
        // Verifies auto-generated barcode format SYN-<CODE>-<LOT>
        assertThat(createdLot.getBarcode()).isEqualTo("SYN-AMI-TOP-LOT-2026-TEST45");

        // Verify GODOWN stock inventory has exactly 45 base units (2 * 20 + 5)
        Optional<StockInventory> godownStock = stockInventoryRepository.findByLotIdAndLocation(createdLot.getId(), "GODOWN");
        assertThat(godownStock).isPresent();
        assertThat(godownStock.get().getQuantity()).isEqualByComparingTo("45.000");

        // Verify GodownMovement audit entry
        List<GodownMovement> movements = godownMovementRepository.findByLotIdOrderByMovementDateDesc(createdLot.getId());
        assertThat(movements).hasSize(1);
        GodownMovement movement = movements.get(0);
        assertThat(movement.getMovementType()).isEqualTo("PURCHASE_ENTRY");
        assertThat(movement.getQuantity()).isEqualByComparingTo("45.000");
        assertThat(movement.getReferenceNo()).isEqualTo("CH-SYN-TEST-01");
    }

    @Test
    @DisplayName("2. Stock transfer of 20 base units from GODOWN to DOKAN decreases GODOWN to 25 and increases DOKAN to 20")
    void testStockTransferGodownToDokan() {
        Product product = productRepository.findByProductCode("SYN-AMI-TOP").orElseThrow();

        LotEntryRequest entryRequest = LotEntryRequest.builder()
                .productId(product.getId())
                .lotNumber("LOT-TRANSFER-01")
                .entryDate(LocalDate.now())
                .expiryDate(LocalDate.of(2028, 12, 31))
                .purchaseCost(new BigDecimal("510.00"))
                .lotRetailPrice(new BigDecimal("650.00"))
                .lotWholesalePrice(new BigDecimal("580.00"))
                .quantityCartons(new BigDecimal("2"))
                .quantityBaseUnits(new BigDecimal("5"))
                .location("GODOWN")
                .challanNo("CH-TRANSFER-01")
                .build();

        InventoryLot lot = inventoryService.recordLotEntry(entryRequest);

        StockTransferRequest transferRequest = StockTransferRequest.builder()
                .lotId(lot.getId())
                .fromLocation("GODOWN")
                .toLocation("DOKAN")
                .quantity(new BigDecimal("20.000"))
                .remarks("Replenish retail counter shelf")
                .build();

        inventoryService.transferStock(transferRequest);

        StockInventory godownStock = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "GODOWN").orElseThrow();
        StockInventory dokanStock = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "DOKAN").orElseThrow();

        // 45 - 20 = 25
        assertThat(godownStock.getQuantity()).isEqualByComparingTo("25.000");
        // 0 + 20 = 20
        assertThat(dokanStock.getQuantity()).isEqualByComparingTo("20.000");

        // Movement audit logging check
        List<GodownMovement> movements = godownMovementRepository.findByLotIdOrderByMovementDateDesc(lot.getId());
        assertThat(movements).hasSize(2);
        GodownMovement latest = movements.get(0);
        assertThat(latest.getMovementType()).isEqualTo("TRANSFER_TO_DOKAN");
        assertThat(latest.getQuantity()).isEqualByComparingTo("20.000");
        assertThat(latest.getRemarks()).isEqualTo("Replenish retail counter shelf");
    }

    @Test
    @DisplayName("3. Attempting to transfer more than available stock in GODOWN throws IllegalArgumentException")
    void testTransferMoreThanAvailableStockThrowsException() {
        Product product = productRepository.findByProductCode("SYN-AMI-TOP").orElseThrow();

        LotEntryRequest entryRequest = LotEntryRequest.builder()
                .productId(product.getId())
                .lotNumber("LOT-OVERDRAW-01")
                .expiryDate(LocalDate.of(2028, 12, 31))
                .purchaseCost(new BigDecimal("500.00"))
                .lotRetailPrice(new BigDecimal("650.00"))
                .lotWholesalePrice(new BigDecimal("580.00"))
                .quantityCartons(new BigDecimal("1"))
                .quantityBaseUnits(new BigDecimal("5")) // 1 * 20 + 5 = 25
                .location("GODOWN")
                .build();

        InventoryLot lot = inventoryService.recordLotEntry(entryRequest);

        StockTransferRequest overdrawRequest = StockTransferRequest.builder()
                .lotId(lot.getId())
                .fromLocation("GODOWN")
                .toLocation("DOKAN")
                .quantity(new BigDecimal("30.000")) // Exceeds 25
                .remarks("Overdraw attempt")
                .build();

        assertThatThrownBy(() -> inventoryService.transferStock(overdrawRequest))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Insufficient stock in GODOWN");
    }

    @Test
    @DisplayName("4. Query live stock overview verifies calculated totals across locations")
    void testGetStockOverviewCalculatesTotals() {
        List<StockItemResponse> overview = inventoryService.getStockOverview();

        assertThat(overview).isNotEmpty();

        // Verify totalQuantity equals dokanQuantity + godownQuantity for each item
        for (StockItemResponse item : overview) {
            assertThat(item.getProductId()).isNotNull();
            assertThat(item.getProductCode()).isNotBlank();
            assertThat(item.getLotId()).isNotNull();
            assertThat(item.getLotNumber()).isNotBlank();
            assertThat(item.getDokanQuantity()).isNotNull();
            assertThat(item.getGodownQuantity()).isNotNull();
            assertThat(item.getTotalQuantity()).isEqualByComparingTo(item.getDokanQuantity().add(item.getGodownQuantity()));
        }

        // Check seeded lot SYN-AMI-202502: DOKAN = 10, GODOWN = 30 -> TOTAL = 40
        StockItemResponse seededItem = overview.stream()
                .filter(i -> "SYN-AMI-202502".equals(i.getBarcode()))
                .findFirst()
                .orElseThrow();
        assertThat(seededItem.getDokanQuantity()).isEqualByComparingTo("10.000");
        assertThat(seededItem.getGodownQuantity()).isEqualByComparingTo("30.000");
        assertThat(seededItem.getTotalQuantity()).isEqualByComparingTo("40.000");
    }

    @Test
    @DisplayName("5. FEFO lot query orders lots strictly by expiryDate ascending")
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
    @DisplayName("Validation edge cases: identical transfer locations, negative quantity, zero base units")
    void testValidationEdgeCases() {
        Product product = productRepository.findByProductCode("SYN-AMI-TOP").orElseThrow();

        // 1. Zero total quantity lot entry
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
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Total quantity must be greater than zero");

        // 2. Same source and destination transfer
        StockTransferRequest sameLocRequest = StockTransferRequest.builder()
                .lotId(1L)
                .fromLocation("GODOWN")
                .toLocation("GODOWN")
                .quantity(BigDecimal.ONE)
                .build();
        assertThatThrownBy(() -> inventoryService.transferStock(sameLocRequest))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cannot be the same");

        // 3. Zero transfer quantity
        StockTransferRequest zeroQtyRequest = StockTransferRequest.builder()
                .lotId(1L)
                .fromLocation("GODOWN")
                .toLocation("DOKAN")
                .quantity(BigDecimal.ZERO)
                .build();
        assertThatThrownBy(() -> inventoryService.transferStock(zeroQtyRequest))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("greater than zero");
    }
}
