package com.alamin.pos.service;

import com.alamin.pos.dto.InventoryLotDto;
import com.alamin.pos.dto.LotEntryRequest;
import com.alamin.pos.dto.StockItemResponse;
import com.alamin.pos.dto.StockTransferRequest;
import com.alamin.pos.entity.GodownMovement;
import com.alamin.pos.entity.InventoryLot;
import com.alamin.pos.entity.Product;
import com.alamin.pos.entity.StockInventory;
import com.alamin.pos.mapper.InventoryLotMapper;
import com.alamin.pos.repository.GodownMovementRepository;
import com.alamin.pos.repository.InventoryLotRepository;
import com.alamin.pos.repository.ProductRepository;
import com.alamin.pos.repository.StockInventoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class InventoryService {

    private final ProductRepository productRepository;
    private final InventoryLotRepository inventoryLotRepository;
    private final StockInventoryRepository stockInventoryRepository;
    private final GodownMovementRepository godownMovementRepository;
    private final InventoryLotMapper inventoryLotMapper;

    @Transactional
    public InventoryLot recordLotEntry(LotEntryRequest request) {
        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new IllegalArgumentException("Product not found with id: " + request.getProductId()));

        // BUSINESS DECISION: Convert carton count to base units using product.cartonMultiplier, plus loose units.
        // Quantities are maintained strictly in base units with NUMERIC(12, 3) precision.
        BigDecimal cartons = request.getQuantityCartons() != null ? request.getQuantityCartons() : BigDecimal.ZERO;
        BigDecimal loose = request.getQuantityBaseUnits() != null ? request.getQuantityBaseUnits() : BigDecimal.ZERO;
        BigDecimal multiplier = product.getCartonMultiplier() != null ? product.getCartonMultiplier() : BigDecimal.ONE;

        BigDecimal totalBaseUnits = cartons.multiply(multiplier).add(loose).setScale(3, RoundingMode.HALF_UP);
        if (totalBaseUnits.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Total quantity must be greater than zero");
        }

        // BUSINESS DECISION: If barcode is not specified, auto-generate SYN-<CODE>-<LOT> format.
        String barcode = request.getBarcode();
        if (barcode == null || barcode.isBlank()) {
            String code = product.getProductCode();
            if (code.startsWith("SYN-")) {
                barcode = code + "-" + request.getLotNumber();
            } else {
                barcode = "SYN-" + code + "-" + request.getLotNumber();
            }
        }

        LocalDate entryDate = request.getEntryDate() != null ? request.getEntryDate() : LocalDate.now();
        String supplier = (request.getSupplierName() != null && !request.getSupplierName().isBlank())
                ? request.getSupplierName() : "Syngenta Bangladesh Ltd.";
        // BUSINESS DECISION: Incoming shipments default to GODOWN bulk warehouse storage unless specified.
        String location = (request.getLocation() != null && !request.getLocation().isBlank())
                ? request.getLocation().trim().toUpperCase() : "GODOWN";

        InventoryLot lot = InventoryLot.builder()
                .product(product)
                .lotNumber(request.getLotNumber())
                .entryDate(entryDate)
                .expiryDate(request.getExpiryDate())
                .purchaseCost(request.getPurchaseCost().setScale(2, RoundingMode.HALF_UP))
                .lotRetailPrice(request.getLotRetailPrice().setScale(2, RoundingMode.HALF_UP))
                .lotWholesalePrice(request.getLotWholesalePrice().setScale(2, RoundingMode.HALF_UP))
                .barcode(barcode)
                .supplierName(supplier)
                .challanNo(request.getChallanNo())
                .build();

        lot = inventoryLotRepository.save(lot);

        Optional<StockInventory> existingStock = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), location);
        StockInventory stock;
        if (existingStock.isPresent()) {
            stock = existingStock.get();
            stock.setQuantity(stock.getQuantity().add(totalBaseUnits));
        } else {
            stock = StockInventory.builder()
                    .lot(lot)
                    .location(location)
                    .quantity(totalBaseUnits)
                    .build();
        }
        stockInventoryRepository.save(stock);

        // BUSINESS DECISION: Audit log every incoming lot receipt as PURCHASE_ENTRY in godown_movement.
        GodownMovement movement = GodownMovement.builder()
                .lot(lot)
                .movementType("PURCHASE_ENTRY")
                .quantity(totalBaseUnits)
                .movementDate(LocalDateTime.now())
                .referenceNo(request.getChallanNo())
                .remarks("Purchase entry: " + totalBaseUnits + " " + product.getBaseUnit() + " received into " + location)
                .build();
        godownMovementRepository.save(movement);

        return lot;
    }

    @Transactional
    public void transferStock(StockTransferRequest request) {
        if (request.getFromLocation() == null || request.getToLocation() == null) {
            throw new IllegalArgumentException("Source and destination locations are required");
        }
        String fromLocation = request.getFromLocation().trim().toUpperCase();
        String toLocation = request.getToLocation().trim().toUpperCase();

        if (fromLocation.equalsIgnoreCase(toLocation)) {
            throw new IllegalArgumentException("Source and destination locations cannot be the same");
        }

        if (request.getQuantity() == null || request.getQuantity().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Transfer quantity must be greater than zero");
        }

        BigDecimal transferQty = request.getQuantity().setScale(3, RoundingMode.HALF_UP);

        InventoryLot lot = inventoryLotRepository.findById(request.getLotId())
                .orElseThrow(() -> new IllegalArgumentException("Lot not found with id: " + request.getLotId()));

        StockInventory sourceStock = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), fromLocation)
                .orElseThrow(() -> new IllegalArgumentException("Insufficient stock in " + fromLocation));

        // BUSINESS DECISION: Strict pre-validation of source stock; prevent negative balance transfers.
        if (sourceStock.getQuantity().compareTo(transferQty) < 0) {
            throw new IllegalArgumentException("Insufficient stock in " + fromLocation);
        }

        sourceStock.setQuantity(sourceStock.getQuantity().subtract(transferQty));
        stockInventoryRepository.save(sourceStock);

        StockInventory destStock = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), toLocation)
                .orElseGet(() -> StockInventory.builder()
                        .lot(lot)
                        .location(toLocation)
                        .quantity(BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP))
                        .build());

        destStock.setQuantity(destStock.getQuantity().add(transferQty));
        stockInventoryRepository.save(destStock);

        // Movement audit logging
        String movementType = "DOKAN".equals(toLocation) ? "TRANSFER_TO_DOKAN" : "TRANSFER_TO_GODOWN";
        GodownMovement movement = GodownMovement.builder()
                .lot(lot)
                .movementType(movementType)
                .quantity(transferQty)
                .movementDate(LocalDateTime.now())
                .remarks(request.getRemarks())
                .build();
        godownMovementRepository.save(movement);
    }

    @Transactional(readOnly = true)
    public List<StockItemResponse> getStockOverview() {
        List<InventoryLot> lots = inventoryLotRepository.findAll();
        List<StockItemResponse> overview = new ArrayList<>();

        for (InventoryLot lot : lots) {
            Product product = lot.getProduct();
            List<StockInventory> stocks = stockInventoryRepository.findByLotId(lot.getId());

            BigDecimal dokanQty = stocks.stream()
                    .filter(s -> "DOKAN".equalsIgnoreCase(s.getLocation()))
                    .map(StockInventory::getQuantity)
                    .findFirst()
                    .orElse(BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP));

            BigDecimal godownQty = stocks.stream()
                    .filter(s -> "GODOWN".equalsIgnoreCase(s.getLocation()))
                    .map(StockInventory::getQuantity)
                    .findFirst()
                    .orElse(BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP));

            BigDecimal totalQty = dokanQty.add(godownQty).setScale(3, RoundingMode.HALF_UP);

            overview.add(StockItemResponse.builder()
                    .productId(product.getId())
                    .productCode(product.getProductCode())
                    .productNameEn(product.getNameEn())
                    .productNameBn(product.getNameBn())
                    .category(product.getCategory())
                    .baseUnit(product.getBaseUnit())
                    .cartonMultiplier(product.getCartonMultiplier())
                    .defaultBarcode(product.getDefaultBarcode())
                    .lotId(lot.getId())
                    .lotNumber(lot.getLotNumber())
                    .entryDate(lot.getEntryDate())
                    .expiryDate(lot.getExpiryDate())
                    .purchaseCost(lot.getPurchaseCost())
                    .lotRetailPrice(lot.getLotRetailPrice())
                    .lotWholesalePrice(lot.getLotWholesalePrice())
                    .barcode(lot.getBarcode())
                    .dokanQuantity(dokanQty)
                    .godownQuantity(godownQty)
                    .totalQuantity(totalQty)
                    .build());
        }

        return overview;
    }

    @Transactional(readOnly = true)
    public List<InventoryLotDto> getLotsByProduct(Long productId, boolean fefoOnly) {
        List<InventoryLot> lots;
        if (productId != null) {
            if (fefoOnly) {
                lots = inventoryLotRepository.findByProductIdOrderByExpiryDateAsc(productId);
            } else {
                lots = inventoryLotRepository.findByProductId(productId);
            }
        } else {
            if (fefoOnly) {
                lots = inventoryLotRepository.findAllByOrderByExpiryDateAsc();
            } else {
                lots = inventoryLotRepository.findAll();
            }
        }
        return inventoryLotMapper.toDtoList(lots);
    }
}
