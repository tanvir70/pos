package com.alamin.pos.service.impl;

import com.alamin.pos.dto.InventoryLotDto;
import com.alamin.pos.dto.LotEntryRequest;
import com.alamin.pos.dto.QuarantineDisposalRequest;
import com.alamin.pos.dto.QuarantineStockResponse;
import com.alamin.pos.dto.StockItemResponse;
import com.alamin.pos.entity.InventoryLot;
import com.alamin.pos.entity.Product;
import com.alamin.pos.entity.StockInventory;
import com.alamin.pos.exception.InsufficientStockException;
import com.alamin.pos.exception.ResourceNotFoundException;
import com.alamin.pos.exception.ValidationException;
import com.alamin.pos.mapper.InventoryLotMapper;
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

import com.alamin.pos.dto.PagedResponse;
import com.alamin.pos.dto.StockAdjustmentRequest;
import com.alamin.pos.dto.StockAdjustmentResponse;
import com.alamin.pos.dto.StockMovementDto;
import com.alamin.pos.dto.StockValuationSummaryDto;
import com.alamin.pos.entity.StockAdjustment;
import com.alamin.pos.entity.StockMovement;
import com.alamin.pos.repository.StockAdjustmentRepository;
import com.alamin.pos.repository.StockMovementRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class InventoryServiceImpl implements InventoryService {

    private final ProductRepository productRepository;
    private final InventoryLotRepository inventoryLotRepository;
    private final StockInventoryRepository stockInventoryRepository;
    private final InventoryLotMapper inventoryLotMapper;
    private final DocumentSequenceService documentSequenceService;
    private final StockMovementRepository stockMovementRepository;
    private final StockAdjustmentRepository stockAdjustmentRepository;

    @Override
    @Transactional
    public InventoryLot recordLotEntry(LotEntryRequest request) {
        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with id: " + request.getProductId()));

        // Convert carton count to base units using product.cartonMultiplier, plus loose units.
        BigDecimal cartons = request.getQuantityCartons() != null ? request.getQuantityCartons() : BigDecimal.ZERO;
        BigDecimal loose = request.getQuantityBaseUnits() != null ? request.getQuantityBaseUnits() : BigDecimal.ZERO;
        BigDecimal multiplier = product.getCartonMultiplier() != null ? product.getCartonMultiplier() : BigDecimal.ONE;

        BigDecimal totalBaseUnits = cartons.multiply(multiplier).add(loose).setScale(3, RoundingMode.HALF_UP);
        if (totalBaseUnits.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ValidationException("Total quantity must be greater than zero");
        }

        String barcode = request.getBarcode();
        if (barcode == null || barcode.isBlank()) {
            barcode = product.getProductCode() + "-" + request.getLotNumber();
        }

        LocalDate entryDate = request.getEntryDate() != null ? request.getEntryDate() : LocalDate.now();
        String supplier = (request.getSupplierName() != null && !request.getSupplierName().isBlank())
                ? request.getSupplierName() : "Agro Chemical Ltd.";
        String location = "DOKAN";

        InventoryLot lot = InventoryLot.builder()
                .product(product)
                .lotNumber(request.getLotNumber())
                .entryDate(entryDate)
                .expiryDate(request.getExpiryDate())
                .purchaseCost(request.getPurchaseCost().setScale(2, RoundingMode.HALF_UP))
                .lotRetailPrice(request.getLotRetailPrice().setScale(2, RoundingMode.HALF_UP))
                .lotWholesalePrice((request.getLotWholesalePrice() != null ? request.getLotWholesalePrice() : request.getLotRetailPrice()).setScale(2, RoundingMode.HALF_UP))
                .barcode(barcode)
                .supplierName(supplier)
                .challanNo(request.getChallanNo())
                .build();

        lot = inventoryLotRepository.save(lot);

        Optional<StockInventory> existingStock = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), location);
        StockInventory stock;
        BigDecimal beforeQty = BigDecimal.ZERO;
        if (existingStock.isPresent()) {
            stock = existingStock.get();
            beforeQty = stock.getQuantity() != null ? stock.getQuantity() : BigDecimal.ZERO;
            stock.setQuantity(beforeQty.add(totalBaseUnits));
        } else {
            stock = StockInventory.builder()
                    .lot(lot)
                    .location(location)
                    .quantity(totalBaseUnits)
                    .build();
        }
        stock = stockInventoryRepository.save(stock);

        // Immutable Bin Card audit record
        stockMovementRepository.save(StockMovement.builder()
                .product(product)
                .lot(lot)
                .movementTime(LocalDateTime.now())
                .movementType("LOT_ENTRY")
                .location(location)
                .quantityChange(totalBaseUnits)
                .balanceBefore(beforeQty)
                .balanceAfter(stock.getQuantity())
                .unit(product.getBaseUnit())
                .referenceDocNo(request.getChallanNo() != null && !request.getChallanNo().isBlank() ? request.getChallanNo() : "LOT-" + lot.getLotNumber())
                .remarks("Inward lot entry: " + (request.getQuantityCartons() != null && request.getQuantityCartons().compareTo(BigDecimal.ZERO) > 0 ? request.getQuantityCartons() + " cartons, " : "") + totalBaseUnits + " " + product.getBaseUnit())
                .performedBy("Store Manager")
                .build());

        return lot;
    }

    @Override
    @Transactional(readOnly = true)
    public List<StockItemResponse> getStockOverview(boolean inStockOnly) {
        if (inStockOnly) {
            List<StockInventory> activeStocks = stockInventoryRepository.findActiveDokanStocks();
            List<StockItemResponse> overview = new ArrayList<>(activeStocks.size());
            for (StockInventory si : activeStocks) {
                InventoryLot lot = si.getLot();
                Product product = lot != null ? lot.getProduct() : null;
                overview.add(StockItemResponse.builder()
                        .productId(product != null ? product.getId() : null)
                        .productCode(product != null ? product.getProductCode() : null)
                        .productNameEn(product != null ? product.getNameEn() : null)
                        .productNameBn(product != null ? product.getNameBn() : null)
                        .category(product != null ? product.getCategory() : null)
                        .baseUnit(product != null ? product.getBaseUnit() : null)
                        .cartonMultiplier(product != null ? product.getCartonMultiplier() : null)
                        .defaultBarcode(product != null ? product.getDefaultBarcode() : null)
                        .buyingPrice(product != null ? product.getBuyingPrice() : null)
                        .lotId(lot != null ? lot.getId() : null)
                        .lotNumber(lot != null ? lot.getLotNumber() : null)
                        .entryDate(lot != null ? lot.getEntryDate() : null)
                        .expiryDate(lot != null ? lot.getExpiryDate() : null)
                        .purchaseCost(lot != null ? lot.getPurchaseCost() : null)
                        .lotRetailPrice(lot != null ? lot.getLotRetailPrice() : null)
                        .lotWholesalePrice(lot != null ? lot.getLotWholesalePrice() : null)
                        .barcode(lot != null ? lot.getBarcode() : null)
                        .quantity(si.getQuantity())
                        .quarantineQuantity(BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP))
                        .build());
            }
            return overview;
        }

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

            BigDecimal availableQty = stocks.stream()
                    .filter(s -> "DOKAN".equalsIgnoreCase(s.getLocation()))
                    .map(StockInventory::getQuantity)
                    .findFirst()
                    .orElse(BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP));

            BigDecimal quarantineQty = stocks.stream()
                    .filter(s -> "QUARANTINE".equalsIgnoreCase(s.getLocation()))
                    .map(StockInventory::getQuantity)
                    .findFirst()
                    .orElse(BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP));

            overview.add(StockItemResponse.builder()
                    .productId(product != null ? product.getId() : null)
                    .productCode(product != null ? product.getProductCode() : null)
                    .productNameEn(product != null ? product.getNameEn() : null)
                    .productNameBn(product != null ? product.getNameBn() : null)
                    .category(product != null ? product.getCategory() : null)
                    .baseUnit(product != null ? product.getBaseUnit() : null)
                    .cartonMultiplier(product != null ? product.getCartonMultiplier() : null)
                    .defaultBarcode(product != null ? product.getDefaultBarcode() : null)
                    .buyingPrice(product != null ? product.getBuyingPrice() : null)
                    .lotId(lot.getId())
                    .lotNumber(lot.getLotNumber())
                    .entryDate(lot.getEntryDate())
                    .expiryDate(lot.getExpiryDate())
                    .purchaseCost(lot.getPurchaseCost())
                    .lotRetailPrice(lot.getLotRetailPrice())
                    .lotWholesalePrice(lot.getLotWholesalePrice())
                    .barcode(lot.getBarcode())
                    .quantity(availableQty)
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

        BigDecimal beforeQty = quarantineStock.getQuantity();
        BigDecimal afterQty = beforeQty.subtract(disposeQty).setScale(3, RoundingMode.HALF_UP);
        quarantineStock.setQuantity(afterQty);
        stockInventoryRepository.save(quarantineStock);

        // Immutable Bin Card audit record
        stockMovementRepository.save(StockMovement.builder()
                .product(lot.getProduct())
                .lot(lot)
                .movementTime(LocalDateTime.now())
                .movementType("QUARANTINE_DISPOSAL")
                .location("QUARANTINE")
                .quantityChange(disposeQty.negate())
                .balanceBefore(beforeQty)
                .balanceAfter(afterQty)
                .unit(lot.getProduct() != null ? lot.getProduct().getBaseUnit() : "Unit")
                .referenceDocNo("DISP-" + lot.getLotNumber())
                .remarks("Hazardous disposal: " + request.getDisposalType() + (request.getRemarks() != null ? " (" + request.getRemarks() + ")" : ""))
                .performedBy("Store Manager")
                .build());

        log.info("Disposed {} units of damaged lot {} from QUARANTINE under type {}", disposeQty, lot.getLotNumber(), request.getDisposalType());
    }

    @Override
    @Transactional
    public StockAdjustmentResponse recordStockAdjustment(StockAdjustmentRequest request) {
        if (request.getQuantity() == null || request.getQuantity().compareTo(BigDecimal.ZERO) <= 0) {
            throw new ValidationException("Adjustment quantity must be greater than zero");
        }

        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with id: " + request.getProductId()));

        InventoryLot lot = inventoryLotRepository.findById(request.getLotId())
                .orElseThrow(() -> new ResourceNotFoundException("Lot not found with id: " + request.getLotId()));

        if (!lot.getProduct().getId().equals(product.getId())) {
            throw new ValidationException("Lot " + lot.getLotNumber() + " does not belong to product " + product.getNameEn());
        }

        BigDecimal adjQty = request.getQuantity().setScale(3, RoundingMode.HALF_UP);
        StockInventory dokanStock = stockInventoryRepository.findByLotIdAndLocationForUpdate(lot.getId(), "DOKAN")
                .orElseThrow(() -> new InsufficientStockException("No active stock found in Dokan for lot " + lot.getLotNumber()));

        BigDecimal beforeDokan = dokanStock.getQuantity() != null ? dokanStock.getQuantity() : BigDecimal.ZERO;
        if (beforeDokan.compareTo(adjQty) < 0) {
            throw new InsufficientStockException("Requested adjustment quantity (" + adjQty + ") exceeds available Dokan stock (" + beforeDokan + ")");
        }

        BigDecimal afterDokan = beforeDokan.subtract(adjQty).setScale(3, RoundingMode.HALF_UP);
        dokanStock.setQuantity(afterDokan);
        stockInventoryRepository.save(dokanStock);

        String adjNo = documentSequenceService.generateAdjustmentNumber();
        String actionType = request.getActionType() != null ? request.getActionType().toUpperCase() : "SCRAP_DISCARD";

        if ("MOVE_TO_QUARANTINE".equals(actionType)) {
            StockInventory quarantineStock = stockInventoryRepository.findByLotIdAndLocationForUpdate(lot.getId(), "QUARANTINE")
                    .orElseGet(() -> StockInventory.builder()
                            .lot(lot)
                            .location("QUARANTINE")
                            .quantity(BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP))
                            .build());

            BigDecimal beforeQuarantine = quarantineStock.getQuantity() != null ? quarantineStock.getQuantity() : BigDecimal.ZERO;
            BigDecimal afterQuarantine = beforeQuarantine.add(adjQty).setScale(3, RoundingMode.HALF_UP);
            quarantineStock.setQuantity(afterQuarantine);
            stockInventoryRepository.save(quarantineStock);

            // Movement 1: Out of Dokan
            stockMovementRepository.save(StockMovement.builder()
                    .product(product)
                    .lot(lot)
                    .movementTime(LocalDateTime.now())
                    .movementType("DAMAGE_TO_QUARANTINE")
                    .location("DOKAN")
                    .quantityChange(adjQty.negate())
                    .balanceBefore(beforeDokan)
                    .balanceAfter(afterDokan)
                    .unit(product.getBaseUnit())
                    .referenceDocNo(adjNo)
                    .remarks(request.getReason())
                    .performedBy(request.getPerformedBy() != null ? request.getPerformedBy() : "Store Manager")
                    .build());

            // Movement 2: Into Quarantine
            stockMovementRepository.save(StockMovement.builder()
                    .product(product)
                    .lot(lot)
                    .movementTime(LocalDateTime.now())
                    .movementType("DAMAGE_RECEIVED_QUARANTINE")
                    .location("QUARANTINE")
                    .quantityChange(adjQty)
                    .balanceBefore(beforeQuarantine)
                    .balanceAfter(afterQuarantine)
                    .unit(product.getBaseUnit())
                    .referenceDocNo(adjNo)
                    .remarks("Transferred from Dokan: " + request.getReason())
                    .performedBy(request.getPerformedBy() != null ? request.getPerformedBy() : "Store Manager")
                    .build());
        } else {
            // SCRAP_DISCARD directly
            stockMovementRepository.save(StockMovement.builder()
                    .product(product)
                    .lot(lot)
                    .movementTime(LocalDateTime.now())
                    .movementType(request.getAdjustmentType())
                    .location("DOKAN")
                    .quantityChange(adjQty.negate())
                    .balanceBefore(beforeDokan)
                    .balanceAfter(afterDokan)
                    .unit(product.getBaseUnit())
                    .referenceDocNo(adjNo)
                    .remarks(request.getReason())
                    .performedBy(request.getPerformedBy() != null ? request.getPerformedBy() : "Store Manager")
                    .build());
        }

        BigDecimal costPrice = lot.getPurchaseCost() != null ? lot.getPurchaseCost() : BigDecimal.ZERO;
        BigDecimal totalLossValue = costPrice.multiply(adjQty).setScale(2, RoundingMode.HALF_UP);

        StockAdjustment adjustment = StockAdjustment.builder()
                .adjustmentNo(adjNo)
                .adjustmentDate(LocalDateTime.now())
                .product(product)
                .lot(lot)
                .adjustmentType(request.getAdjustmentType())
                .quantity(adjQty)
                .unit(product.getBaseUnit())
                .actionType(actionType)
                .costPrice(costPrice)
                .totalLossValue(totalLossValue)
                .reason(request.getReason())
                .performedBy(request.getPerformedBy() != null ? request.getPerformedBy() : "Store Manager")
                .build();

        adjustment = stockAdjustmentRepository.save(adjustment);

        return StockAdjustmentResponse.builder()
                .id(adjustment.getId())
                .adjustmentNo(adjustment.getAdjustmentNo())
                .adjustmentDate(adjustment.getAdjustmentDate())
                .productId(product.getId())
                .productCode(product.getProductCode())
                .productNameEn(product.getNameEn())
                .productNameBn(product.getNameBn())
                .lotId(lot.getId())
                .lotNumber(lot.getLotNumber())
                .adjustmentType(adjustment.getAdjustmentType())
                .quantity(adjustment.getQuantity())
                .unit(adjustment.getUnit())
                .actionType(adjustment.getActionType())
                .costPrice(adjustment.getCostPrice())
                .totalLossValue(adjustment.getTotalLossValue())
                .reason(adjustment.getReason())
                .performedBy(adjustment.getPerformedBy())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public PagedResponse<StockMovementDto> getStockMovements(Long productId, Long lotId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "movementTime", "id"));
        Page<StockMovement> pageResult = stockMovementRepository.searchMovements(productId, lotId, pageable);

        List<StockMovementDto> dtoList = pageResult.getContent().stream().map(sm -> StockMovementDto.builder()
                .id(sm.getId())
                .productId(sm.getProduct() != null ? sm.getProduct().getId() : null)
                .productCode(sm.getProduct() != null ? sm.getProduct().getProductCode() : null)
                .productNameEn(sm.getProduct() != null ? sm.getProduct().getNameEn() : null)
                .productNameBn(sm.getProduct() != null ? sm.getProduct().getNameBn() : null)
                .lotId(sm.getLot() != null ? sm.getLot().getId() : null)
                .lotNumber(sm.getLot() != null ? sm.getLot().getLotNumber() : null)
                .barcode(sm.getLot() != null ? sm.getLot().getBarcode() : null)
                .movementTime(sm.getMovementTime())
                .movementType(sm.getMovementType())
                .location(sm.getLocation())
                .quantityChange(sm.getQuantityChange())
                .balanceBefore(sm.getBalanceBefore())
                .balanceAfter(sm.getBalanceAfter())
                .unit(sm.getUnit())
                .referenceDocNo(sm.getReferenceDocNo())
                .remarks(sm.getRemarks())
                .performedBy(sm.getPerformedBy())
                .build()).collect(Collectors.toList());

        return PagedResponse.<StockMovementDto>builder()
                .content(dtoList)
                .pageNumber(pageResult.getNumber())
                .pageSize(pageResult.getSize())
                .totalElements(pageResult.getTotalElements())
                .totalPages(pageResult.getTotalPages())
                .first(pageResult.isFirst())
                .last(pageResult.isLast())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public PagedResponse<StockAdjustmentResponse> getStockAdjustments(Long productId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "adjustmentDate", "id"));
        Page<StockAdjustment> pageResult = productId != null
                ? stockAdjustmentRepository.findByProductIdOrderByAdjustmentDateDescIdDesc(productId, pageable)
                : stockAdjustmentRepository.findAllByOrderByAdjustmentDateDescIdDesc(pageable);

        List<StockAdjustmentResponse> dtoList = pageResult.getContent().stream().map(sa -> StockAdjustmentResponse.builder()
                .id(sa.getId())
                .adjustmentNo(sa.getAdjustmentNo())
                .adjustmentDate(sa.getAdjustmentDate())
                .productId(sa.getProduct() != null ? sa.getProduct().getId() : null)
                .productCode(sa.getProduct() != null ? sa.getProduct().getProductCode() : null)
                .productNameEn(sa.getProduct() != null ? sa.getProduct().getNameEn() : null)
                .productNameBn(sa.getProduct() != null ? sa.getProduct().getNameBn() : null)
                .lotId(sa.getLot() != null ? sa.getLot().getId() : null)
                .lotNumber(sa.getLot() != null ? sa.getLot().getLotNumber() : null)
                .adjustmentType(sa.getAdjustmentType())
                .quantity(sa.getQuantity())
                .unit(sa.getUnit())
                .actionType(sa.getActionType())
                .costPrice(sa.getCostPrice())
                .totalLossValue(sa.getTotalLossValue())
                .reason(sa.getReason())
                .performedBy(sa.getPerformedBy())
                .build()).collect(Collectors.toList());

        return PagedResponse.<StockAdjustmentResponse>builder()
                .content(dtoList)
                .pageNumber(pageResult.getNumber())
                .pageSize(pageResult.getSize())
                .totalElements(pageResult.getTotalElements())
                .totalPages(pageResult.getTotalPages())
                .first(pageResult.isFirst())
                .last(pageResult.isLast())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public StockValuationSummaryDto getStockValuationSummary() {
        List<StockInventory> allDokanStocks = stockInventoryRepository.findActiveDokanStocks();
        BigDecimal totalCost = BigDecimal.ZERO;
        BigDecimal totalRetail = BigDecimal.ZERO;
        BigDecimal totalWholesale = BigDecimal.ZERO;
        BigDecimal totalUnits = BigDecimal.ZERO;
        Set<Long> productIds = new HashSet<>();
        long activeLots = 0;

        for (StockInventory si : allDokanStocks) {
            if (si.getQuantity() != null && si.getQuantity().compareTo(BigDecimal.ZERO) > 0) {
                InventoryLot lot = si.getLot();
                BigDecimal qty = si.getQuantity();
                totalUnits = totalUnits.add(qty);
                activeLots++;
                if (lot != null) {
                    if (lot.getProduct() != null) {
                        productIds.add(lot.getProduct().getId());
                    }
                    BigDecimal cost = lot.getPurchaseCost() != null ? lot.getPurchaseCost() : BigDecimal.ZERO;
                    BigDecimal retail = lot.getLotRetailPrice() != null ? lot.getLotRetailPrice() :
                            (lot.getProduct() != null ? lot.getProduct().getStandardRetailPrice() : BigDecimal.ZERO);
                    BigDecimal wholesale = lot.getLotWholesalePrice() != null ? lot.getLotWholesalePrice() :
                            (lot.getProduct() != null && lot.getProduct().getStandardWholesalePrice() != null ?
                                    lot.getProduct().getStandardWholesalePrice() : retail);

                    totalCost = totalCost.add(cost.multiply(qty));
                    totalRetail = totalRetail.add(retail.multiply(qty));
                    totalWholesale = totalWholesale.add(wholesale.multiply(qty));
                }
            }
        }

        List<StockInventory> quarantineStocks = stockInventoryRepository.findByLocation("QUARANTINE");
        BigDecimal quarantineLoss = BigDecimal.ZERO;
        for (StockInventory qs : quarantineStocks) {
            if (qs.getQuantity() != null && qs.getQuantity().compareTo(BigDecimal.ZERO) > 0 && qs.getLot() != null) {
                BigDecimal cost = qs.getLot().getPurchaseCost() != null ? qs.getLot().getPurchaseCost() : BigDecimal.ZERO;
                quarantineLoss = quarantineLoss.add(cost.multiply(qs.getQuantity()));
            }
        }

        return StockValuationSummaryDto.builder()
                .totalCostValuation(totalCost.setScale(2, RoundingMode.HALF_UP))
                .totalRetailValuation(totalRetail.setScale(2, RoundingMode.HALF_UP))
                .totalWholesaleValuation(totalWholesale.setScale(2, RoundingMode.HALF_UP))
                .potentialGrossProfit(totalRetail.subtract(totalCost).setScale(2, RoundingMode.HALF_UP))
                .totalQuarantineLoss(quarantineLoss.setScale(2, RoundingMode.HALF_UP))
                .totalActiveLots(activeLots)
                .totalProductsInStock((long) productIds.size())
                .totalUnitsInStock(totalUnits.setScale(3, RoundingMode.HALF_UP))
                .build();
    }
}
