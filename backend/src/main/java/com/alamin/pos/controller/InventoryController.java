package com.alamin.pos.controller;

import com.alamin.pos.dto.InventoryLotDto;
import com.alamin.pos.dto.LotEntryRequest;
import com.alamin.pos.dto.StockItemResponse;
import com.alamin.pos.dto.StockTransferRequest;
import com.alamin.pos.entity.InventoryLot;
import com.alamin.pos.mapper.InventoryLotMapper;
import com.alamin.pos.service.InventoryService;
import com.alamin.pos.security.SecurityUtils;
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
        if (!SecurityUtils.isOwner()) {
            dto.setPurchaseCost(null);
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @PostMapping("/transfer")
    public ResponseEntity<Map<String, String>> transferStock(@Valid @RequestBody StockTransferRequest request) {
        inventoryService.transferStock(request);
        return ResponseEntity.ok(Map.of("message", "Stock transferred successfully"));
    }

    @GetMapping("/stock")
    public ResponseEntity<List<StockItemResponse>> getStockOverview() {
        List<StockItemResponse> stock = inventoryService.getStockOverview();
        if (!SecurityUtils.isOwner()) {
            stock.forEach(item -> item.setPurchaseCost(null));
        }
        return ResponseEntity.ok(stock);
    }

    @GetMapping("/lots")
    public ResponseEntity<List<InventoryLotDto>> getLots(
            @RequestParam(required = false) Long productId,
            @RequestParam(name = "fefo", defaultValue = "false") boolean fefo) {
        List<InventoryLotDto> lots = inventoryService.getLotsByProduct(productId, fefo);
        if (!SecurityUtils.isOwner()) {
            lots.forEach(lot -> lot.setPurchaseCost(null));
        }
        return ResponseEntity.ok(lots);
    }
}

