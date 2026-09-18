package com.alamin.pos.controller;

import com.alamin.pos.dto.DashboardSummaryDto;
import com.alamin.pos.dto.TopSellingProductDto;
import com.alamin.pos.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/summary")
    public ResponseEntity<DashboardSummaryDto> getSummary() {
        return ResponseEntity.ok(dashboardService.getSummary());
    }

    @GetMapping("/top-selling")
    public ResponseEntity<List<TopSellingProductDto>> getTopSelling(
            @RequestParam(name = "period", defaultValue = "month") String period,
            @RequestParam(name = "limit", defaultValue = "5") int limit) {
        return ResponseEntity.ok(dashboardService.getTopSellingProducts(period, limit));
    }
}
