package com.alamin.pos.controller;

import com.alamin.pos.dto.InventoryLotDto;
import com.alamin.pos.dto.LotEntryRequest;
import com.alamin.pos.dto.PagedResponse;
import com.alamin.pos.dto.StockAdjustmentRequest;
import com.alamin.pos.dto.StockAdjustmentResponse;
import com.alamin.pos.dto.StockItemResponse;
import com.alamin.pos.dto.StockMovementDto;
import com.alamin.pos.dto.StockValuationSummaryDto;
import com.alamin.pos.entity.InventoryLot;
import com.alamin.pos.mapper.InventoryLotMapper;
import com.alamin.pos.service.InventoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;
    private final InventoryLotMapper inventoryLotMapper;

    @PostMapping("/lots")
    public ResponseEntity<InventoryLotDto> recordLotEntry(@Valid @RequestBody LotEntryRequest request) {
        InventoryLot lot = inventoryService.recordLotEntry(request);
        InventoryLotDto dto = inventoryLotMapper.toDto(lot);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @GetMapping("/stock")
    public ResponseEntity<?> getStockOverview(
            @RequestParam(name = "inStockOnly", defaultValue = "false") boolean inStockOnly,
            @RequestParam(name = "paged", defaultValue = "false") boolean paged,
            org.springframework.data.domain.Pageable pageable) {
        List<StockItemResponse> stock = inventoryService.getStockOverview(inStockOnly);
        if (paged) {
            int start = (int) pageable.getOffset();
            int end = Math.min((start + pageable.getPageSize()), stock.size());
            List<StockItemResponse> subList = start > stock.size() ? List.of() : stock.subList(start, end);
            org.springframework.data.domain.Page<StockItemResponse> page =
                    new org.springframework.data.domain.PageImpl<>(subList, pageable, stock.size());
            return ResponseEntity.ok(page);
        }
        return ResponseEntity.ok(stock);
    }


    @GetMapping("/lots")
    public ResponseEntity<List<InventoryLotDto>> getLots(
            @RequestParam(required = false) Long productId,
            @RequestParam(name = "fefo", defaultValue = "false") boolean fefo) {
        List<InventoryLotDto> lots = inventoryService.getLotsByProduct(productId, fefo);
        return ResponseEntity.ok(lots);
    }

    @GetMapping("/quarantine")
    public ResponseEntity<List<com.alamin.pos.dto.QuarantineStockResponse>> getQuarantineOverview() {
        List<com.alamin.pos.dto.QuarantineStockResponse> list = inventoryService.getQuarantineStockOverview();
        return ResponseEntity.ok(list);
    }

    @PostMapping("/quarantine/dispose")
    public ResponseEntity<Map<String, String>> disposeQuarantineStock(
            @Valid @RequestBody com.alamin.pos.dto.QuarantineDisposalRequest request) {
        inventoryService.disposeQuarantineStock(request);
        return ResponseEntity.ok(Map.of("message", "Quarantine stock disposed successfully"));
    }

    @PostMapping("/adjustments")
    public ResponseEntity<StockAdjustmentResponse> recordStockAdjustment(
            @Valid @RequestBody StockAdjustmentRequest request) {
        StockAdjustmentResponse response = inventoryService.recordStockAdjustment(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/adjustments")
    public ResponseEntity<PagedResponse<StockAdjustmentResponse>> getStockAdjustments(
            @RequestParam(required = false) Long productId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "15") int size) {
        PagedResponse<StockAdjustmentResponse> adjustments = inventoryService.getStockAdjustments(productId, page, size);
        return ResponseEntity.ok(adjustments);
    }

    @GetMapping("/movements")
    public ResponseEntity<PagedResponse<StockMovementDto>> getStockMovements(
            @RequestParam(required = false) Long productId,
            @RequestParam(required = false) Long lotId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PagedResponse<StockMovementDto> movements = inventoryService.getStockMovements(productId, lotId, page, size);
        return ResponseEntity.ok(movements);
    }

    @GetMapping("/valuation")
    public ResponseEntity<StockValuationSummaryDto> getStockValuation() {
        StockValuationSummaryDto valuation = inventoryService.getStockValuationSummary();
        return ResponseEntity.ok(valuation);
    }
}
