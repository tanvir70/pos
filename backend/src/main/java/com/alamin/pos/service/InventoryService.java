package com.alamin.pos.service;

import com.alamin.pos.dto.InventoryLotDto;
import com.alamin.pos.dto.LotEntryRequest;
import com.alamin.pos.dto.QuarantineDisposalRequest;
import com.alamin.pos.dto.QuarantineStockResponse;
import com.alamin.pos.dto.StockItemResponse;
import com.alamin.pos.dto.PagedResponse;
import com.alamin.pos.dto.StockAdjustmentRequest;
import com.alamin.pos.dto.StockAdjustmentResponse;
import com.alamin.pos.dto.StockMovementDto;
import com.alamin.pos.dto.StockValuationSummaryDto;
import com.alamin.pos.entity.InventoryLot;

import java.util.List;

public interface InventoryService {

    InventoryLot recordLotEntry(LotEntryRequest request);

    default List<StockItemResponse> getStockOverview() {
        return getStockOverview(false);
    }

    List<StockItemResponse> getStockOverview(boolean inStockOnly);

    List<InventoryLotDto> getLotsByProduct(Long productId, boolean fefoOnly);

    List<QuarantineStockResponse> getQuarantineStockOverview();

    void disposeQuarantineStock(QuarantineDisposalRequest request);

    StockAdjustmentResponse recordStockAdjustment(StockAdjustmentRequest request);

    PagedResponse<StockMovementDto> getStockMovements(Long productId, Long lotId, int page, int size);

    PagedResponse<StockAdjustmentResponse> getStockAdjustments(Long productId, int page, int size);

    StockValuationSummaryDto getStockValuationSummary();
}
