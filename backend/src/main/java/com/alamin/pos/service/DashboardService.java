package com.alamin.pos.service;

import com.alamin.pos.dto.DashboardSummaryDto;
import com.alamin.pos.dto.TopSellingProductDto;

import java.util.List;

public interface DashboardService {

    DashboardSummaryDto getSummary();

    List<TopSellingProductDto> getTopSellingProducts(String period, int limit);
}
