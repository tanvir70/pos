package com.alamin.pos.service;

import com.alamin.pos.dto.SaleReturnRequest;
import com.alamin.pos.dto.SaleReturnResponse;

import java.util.List;

public interface SaleReturnService {

    SaleReturnResponse processReturn(SaleReturnRequest request);

    SaleReturnResponse getReturnById(Long id);

    List<SaleReturnResponse> getRecentReturns(int limit);
}
