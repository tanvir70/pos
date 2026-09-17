package com.alamin.pos.controller;

import com.alamin.pos.dto.SaleRequest;
import com.alamin.pos.dto.SaleResponse;
import com.alamin.pos.security.SecurityUtils;
import com.alamin.pos.service.SaleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/sales")
@RequiredArgsConstructor
public class SaleController {

    private final SaleService saleService;

    @PostMapping
    public ResponseEntity<SaleResponse> processSale(@Valid @RequestBody SaleRequest request) {
        SaleResponse response = saleService.processSale(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(maskCostsIfNeeded(response));
    }

    @GetMapping("/{id}")
    public ResponseEntity<SaleResponse> getSaleById(@PathVariable Long id) {
        return ResponseEntity.ok(maskCostsIfNeeded(saleService.getSaleById(id)));
    }

    @GetMapping("/invoice/{invoiceNo}")
    public ResponseEntity<SaleResponse> getSaleByInvoiceNo(@PathVariable String invoiceNo) {
        return ResponseEntity.ok(maskCostsIfNeeded(saleService.getSaleByInvoiceNo(invoiceNo)));
    }

    @GetMapping
    public ResponseEntity<List<SaleResponse>> getRecentSales(
            @RequestParam(name = "limit", defaultValue = "50") int limit) {
        List<SaleResponse> sales = saleService.getRecentSales(limit);
        return ResponseEntity.ok(sales.stream().map(this::maskCostsIfNeeded).toList());
    }

    private SaleResponse maskCostsIfNeeded(SaleResponse response) {
        if (response == null || SecurityUtils.isOwner()) {
            return response;
        }
        response.setTotalProfit(null);
        if (response.getItems() != null) {
            response.getItems().forEach(item -> {
                item.setUnitCost(null);
                item.setLineProfit(null);
            });
        }
        return response;
    }
}

