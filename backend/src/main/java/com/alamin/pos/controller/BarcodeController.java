package com.alamin.pos.controller;

import com.alamin.pos.entity.InventoryLot;
import com.alamin.pos.exception.ResourceNotFoundException;
import com.alamin.pos.repository.InventoryLotRepository;
import com.alamin.pos.service.BarcodeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class BarcodeController {

    private final BarcodeService barcodeService;
    private final InventoryLotRepository inventoryLotRepository;

    // BUSINESS DECISION: Barcode PNGs include HTTP 24-hour cache headers (max-age=86400) because
    // lot barcodes are immutable. Caching eliminates duplicate CPU and I/O rendering overhead during bulk sticker printing.
    @GetMapping(value = "/barcode/{barcode}", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> getBarcodeImage(
            @PathVariable String barcode,
            @RequestParam(defaultValue = "300") int width,
            @RequestParam(defaultValue = "100") int height) {
        byte[] imageBytes = barcodeService.generateBarcodePng(barcode, width, height);
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=86400")
                .body(imageBytes);
    }

    @GetMapping(value = "/lots/{lotId}/barcode-image", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> getLotBarcodeImage(
            @PathVariable Long lotId,
            @RequestParam(defaultValue = "300") int width,
            @RequestParam(defaultValue = "100") int height) {
        InventoryLot lot = inventoryLotRepository.findById(lotId)
                .orElseThrow(() -> new ResourceNotFoundException("Lot not found with id: " + lotId));

        byte[] imageBytes = barcodeService.generateBarcodePng(lot.getBarcode(), width, height);
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=86400")
                .body(imageBytes);
    }
}
