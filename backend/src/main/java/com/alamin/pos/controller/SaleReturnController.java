package com.alamin.pos.controller;

import com.alamin.pos.dto.SaleReturnRequest;
import com.alamin.pos.dto.SaleReturnResponse;
import com.alamin.pos.service.SaleReturnService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/returns")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class SaleReturnController {

    private final SaleReturnService saleReturnService;

    @PostMapping
    public ResponseEntity<SaleReturnResponse> processReturn(@Valid @RequestBody SaleReturnRequest request) {
        SaleReturnResponse response = saleReturnService.processReturn(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<SaleReturnResponse> getReturnById(@PathVariable Long id) {
        return ResponseEntity.ok(saleReturnService.getReturnById(id));
    }

    @GetMapping
    public ResponseEntity<List<SaleReturnResponse>> getRecentReturns(
            @RequestParam(name = "limit", defaultValue = "50") int limit) {
        return ResponseEntity.ok(saleReturnService.getRecentReturns(limit));
    }
}
