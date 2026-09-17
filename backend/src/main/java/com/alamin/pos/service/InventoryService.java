package com.alamin.pos.service;

import com.alamin.pos.dto.InventoryLotDto;
import com.alamin.pos.dto.LotEntryRequest;
import com.alamin.pos.dto.QuarantineDisposalRequest;
import com.alamin.pos.dto.QuarantineStockResponse;
import com.alamin.pos.dto.StockItemResponse;
import com.alamin.pos.entity.InventoryLot;

import java.util.List;

public interface InventoryService {

    InventoryLot recordLotEntry(LotEntryRequest request);

    List<StockItemResponse> getStockOverview();

    List<InventoryLotDto> getLotsByProduct(Long productId, boolean fefoOnly);

    List<QuarantineStockResponse> getQuarantineStockOverview();

    void disposeQuarantineStock(QuarantineDisposalRequest request);
}
