package com.alamin.pos.service.impl;

import com.alamin.pos.dto.InventoryLotDto;
import com.alamin.pos.dto.LotEntryRequest;
import com.alamin.pos.dto.QuarantineDisposalRequest;
import com.alamin.pos.dto.QuarantineStockResponse;
import com.alamin.pos.dto.StockItemResponse;
import com.alamin.pos.dto.StockTransferRequest;
import com.alamin.pos.entity.GodownMovement;
import com.alamin.pos.entity.InventoryLot;
import com.alamin.pos.entity.Product;
import com.alamin.pos.entity.StockInventory;
import com.alamin.pos.exception.InsufficientStockException;
import com.alamin.pos.exception.ResourceNotFoundException;
import com.alamin.pos.exception.ValidationException;
import com.alamin.pos.mapper.InventoryLotMapper;
import com.alamin.pos.repository.GodownMovementRepository;
import com.alamin.pos.repository.InventoryLotRepository;
import com.alamin.pos.repository.ProductRepository;
import com.alamin.pos.repository.StockInventoryRepository;
import com.alamin.pos.service.DocumentSequenceService;
import com.alamin.pos.service.InventoryService;
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
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class InventoryServiceImpl implements InventoryService {

    private final ProductRepository productRepository;
    private final InventoryLotRepository inventoryLotRepository;
    private final StockInventoryRepository stockInventoryRepository;
    private final GodownMovementRepository godownMovementRepository;
    private final InventoryLotMapper inventoryLotMapper;
    private final DocumentSequenceService documentSequenceService;

    @Override
    @Transactional
    public InventoryLot recordLotEntry(LotEntryRequest request) {
        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with id: " + request.getProductId()));

        // BUSINESS DECISION: Convert carton count to base units using product.cartonMultiplier, plus loose units.
        // Quantities are maintained strictly in base units with NUMERIC(12, 3) precision.
        BigDecimal cartons = request.getQuantityCartons() != null ? request.getQuantityCartons() : BigDecimal.ZERO;
        BigDecimal loose = request.getQuantityBaseUnits() != null ? request.getQuantityBaseUnits() : BigDecimal.ZERO;
        BigDecimal multiplier = product.getCartonMultiplier() != null ? product.getCartonMultiplier() : BigDecimal.ONE;

        BigDecimal totalBaseUnits = cartons.multiply(multiplier).add(loose).setScale(3, RoundingMode.HALF_UP);
        if (totalBaseUnits.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ValidationException("Total quantity must be greater than zero");
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

    @Override
    @Transactional
    public void transferStock(StockTransferRequest request) {
        if (request.getFromLocation() == null || request.getToLocation() == null) {
            throw new ValidationException("Source and destination locations are required");
        }
        String fromLocation = request.getFromLocation().trim().toUpperCase();
        String toLocation = request.getToLocation().trim().toUpperCase();

        if (fromLocation.equalsIgnoreCase(toLocation)) {
            throw new ValidationException("Source and destination locations cannot be the same");
        }

        if (request.getQuantity() == null || request.getQuantity().compareTo(BigDecimal.ZERO) <= 0) {
            throw new ValidationException("Transfer quantity must be greater than zero");
        }

        BigDecimal transferQty = request.getQuantity().setScale(3, RoundingMode.HALF_UP);

        InventoryLot lot = inventoryLotRepository.findById(request.getLotId())
                .orElseThrow(() -> new ResourceNotFoundException("Lot not found with id: " + request.getLotId()));

        StockInventory sourceStock = stockInventoryRepository.findByLotIdAndLocationForUpdate(lot.getId(), fromLocation)
                .orElseThrow(() -> new InsufficientStockException("Insufficient stock in " + fromLocation));

        // BUSINESS DECISION: Strict pre-validation of source stock; prevent negative balance transfers.
        if (sourceStock.getQuantity().compareTo(transferQty) < 0) {
            throw new InsufficientStockException("Insufficient stock in " + fromLocation);
        }

        sourceStock.setQuantity(sourceStock.getQuantity().subtract(transferQty));
        stockInventoryRepository.save(sourceStock);

        StockInventory destStock = stockInventoryRepository.findByLotIdAndLocationForUpdate(lot.getId(), toLocation)
                .orElseGet(() -> StockInventory.builder()
                        .lot(lot)
                        .location(toLocation)
                        .quantity(BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP))
                        .build());

        destStock.setQuantity(destStock.getQuantity().add(transferQty));
        stockInventoryRepository.save(destStock);

        // Movement audit logging
        String transferRef = documentSequenceService.generateTransferNumber();
        String movementType = "DOKAN".equals(toLocation) ? "TRANSFER_TO_DOKAN" : "TRANSFER_TO_GODOWN";
        GodownMovement movement = GodownMovement.builder()
                .lot(lot)
                .movementType(movementType)
                .quantity(transferQty)
                .movementDate(LocalDateTime.now())
                .referenceNo(transferRef)
                .remarks(request.getRemarks())
                .build();
        godownMovementRepository.save(movement);
    }

    @Override
    @Transactional(readOnly = true)
    public List<StockItemResponse> getStockOverview() {
        List<InventoryLot> lots = inventoryLotRepository.findAllWithProduct();
        List<Long> lotIds = lots.stream().map(InventoryLot::getId).toList();
        java.util.Map<Long, List<StockInventory>> stocksByLot = lotIds.isEmpty()
                ? java.util.Map.of()
                : stockInventoryRepository.findByLotIdIn(lotIds).stream()
                .collect(java.util.stream.Collectors.groupingBy(si -> si.getLot().getId()));

        List<StockItemResponse> overview = new ArrayList<>();

        for (InventoryLot lot : lots) {
            Product product = lot.getProduct();
            List<StockInventory> stocks = stocksByLot.getOrDefault(lot.getId(), List.of());

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

            BigDecimal quarantineQty = stocks.stream()
                    .filter(s -> "QUARANTINE".equalsIgnoreCase(s.getLocation()))
                    .map(StockInventory::getQuantity)
                    .findFirst()
                    .orElse(BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP));

            BigDecimal totalQty = dokanQty.add(godownQty).setScale(3, RoundingMode.HALF_UP);

            overview.add(StockItemResponse.builder()
                    .productId(product != null ? product.getId() : null)
                    .productCode(product != null ? product.getProductCode() : null)
                    .productNameEn(product != null ? product.getNameEn() : null)
                    .productNameBn(product != null ? product.getNameBn() : null)
                    .category(product != null ? product.getCategory() : null)
                    .baseUnit(product != null ? product.getBaseUnit() : null)
                    .cartonMultiplier(product != null ? product.getCartonMultiplier() : null)
                    .defaultBarcode(product != null ? product.getDefaultBarcode() : null)
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
                    .quarantineQuantity(quarantineQty)
                    .build());
        }

        return overview;
    }


    @Override
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

    @Override
    @Transactional(readOnly = true)
    public List<QuarantineStockResponse> getQuarantineStockOverview() {
        List<StockInventory> quarantineStocks = stockInventoryRepository.findActiveQuarantineStocks();
        List<QuarantineStockResponse> responseList = new ArrayList<>();

        for (StockInventory si : quarantineStocks) {
            InventoryLot lot = si.getLot();
            Product product = lot != null ? lot.getProduct() : null;
            BigDecimal qty = si.getQuantity();
            BigDecimal unitCost = (lot != null && lot.getPurchaseCost() != null)
                    ? lot.getPurchaseCost().setScale(2, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
            BigDecimal totalLoss = unitCost.multiply(qty).setScale(2, RoundingMode.HALF_UP);

            responseList.add(QuarantineStockResponse.builder()
                    .productId(product != null ? product.getId() : null)
                    .productCode(product != null ? product.getProductCode() : null)
                    .productNameEn(product != null ? product.getNameEn() : null)
                    .productNameBn(product != null ? product.getNameBn() : null)
                    .baseUnit(product != null ? product.getBaseUnit() : null)
                    .lotId(lot != null ? lot.getId() : null)
                    .lotNumber(lot != null ? lot.getLotNumber() : null)
                    .barcode(lot != null ? lot.getBarcode() : null)
                    .expiryDate(lot != null ? lot.getExpiryDate() : null)
                    .supplierName(lot != null ? lot.getSupplierName() : null)
                    .quarantineQuantity(qty)
                    .purchaseCost(unitCost)
                    .lotRetailPrice(lot != null ? lot.getLotRetailPrice() : null)
                    .totalLossValue(totalLoss)
                    .build());
        }

        return responseList;
    }

    @Override
    @Transactional
    public void disposeQuarantineStock(QuarantineDisposalRequest request) {
        if (request.getQuantity() == null || request.getQuantity().compareTo(BigDecimal.ZERO) <= 0) {
            throw new ValidationException("Disposal quantity must be greater than zero");
        }

        BigDecimal disposeQty = request.getQuantity().setScale(3, RoundingMode.HALF_UP);
        InventoryLot lot = inventoryLotRepository.findById(request.getLotId())
                .orElseThrow(() -> new ResourceNotFoundException("Lot not found with id: " + request.getLotId()));

        StockInventory quarantineStock = stockInventoryRepository.findByLotIdAndLocationForUpdate(lot.getId(), "QUARANTINE")
                .orElseThrow(() -> new InsufficientStockException("No quarantine stock found for lot " + lot.getLotNumber()));

        if (quarantineStock.getQuantity().compareTo(disposeQty) < 0) {
            throw new InsufficientStockException("Requested disposal quantity (" + disposeQty + ") exceeds available quarantine stock (" + quarantineStock.getQuantity() + ") for lot " + lot.getLotNumber());
        }

        quarantineStock.setQuantity(quarantineStock.getQuantity().subtract(disposeQty).setScale(3, RoundingMode.HALF_UP));
        stockInventoryRepository.save(quarantineStock);

        String refNo = "DISP-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        String remarks = (request.getRemarks() != null && !request.getRemarks().isBlank())
                ? request.getRemarks()
                : "Quarantine stock disposal: " + request.getDisposalType();

        GodownMovement movement = GodownMovement.builder()
                .lot(lot)
                .movementType("DAMAGE_EXIT")
                .quantity(disposeQty)
                .movementDate(LocalDateTime.now())
                .referenceNo(refNo)
                .remarks(remarks + " [" + request.getDisposalType() + "]")
                .build();
        godownMovementRepository.save(movement);

        log.info("Disposed {} units of damaged lot {} from QUARANTINE under type {}", disposeQty, lot.getLotNumber(), request.getDisposalType());
    }
}
