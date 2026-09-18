package com.alamin.pos.service;

import com.alamin.pos.dto.PagedResponse;
import com.alamin.pos.dto.SaleRequest;
import com.alamin.pos.dto.SaleResponse;

import java.util.List;

public interface SaleService {

    SaleResponse processSale(SaleRequest request);

    SaleResponse getSaleById(Long id);

    SaleResponse getSaleByInvoiceNo(String invoiceNo);

    List<SaleResponse> getRecentSales(int limit);

    PagedResponse<SaleResponse> getSales(int page, int size, String period, String saleMode);
}
