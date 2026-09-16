# Task 5 Brief: ZXing Barcode Generation Engine

## Context & Objectives
You are the implementer for Task 5.
Your goal is to implement the barcode generation engine using ZXing (`Code128Writer` / `MatrixToImageWriter`), producing high-contrast, printable 1D Code 128 barcode images (PNG format) suitable for sticker printing and scanning.

## Strict Rules
- Ponytail engineering: Minimal, high performance, robust error handling, zero bloat.
- Zero assumptions: If any business or technical judgment is made, add `// BUSINESS DECISION:` directly in code and append a line to `DECISIONS_LOG.md`.
- No subagents contract: Do NOT invoke any subagents. You do all work directly.

## Deliverables

### 1. Service (`com.alamin.pos.service.BarcodeService`)
- `byte[] generateBarcodePng(String barcodeText, int width, int height)`:
  - Validates `barcodeText` is not null or empty.
  - Uses `com.google.zxing.oned.Code128Writer` to encode `barcodeText` into `BitMatrix` using `BarcodeFormat.CODE_128`.
  - Uses `MatrixToImageWriter.writeToStream(bitMatrix, "PNG", outputStream)` to write PNG bytes.
  - Handles errors cleanly with meaningful runtime exception (`IllegalArgumentException` or `BarcodeGenerationException`).
- `String generateBarcodeBase64(String barcodeText, int width, int height)`:
  - Helper returning Base64 data URL (`data:image/png;base64,...`) for easy embedding into HTML/React sticker printing templates.

### 2. Controller (`com.alamin.pos.controller.BarcodeController`)
- `GET /api/barcode/{barcode}`:
  - Returns `ResponseEntity<byte[]>` with `MediaType.IMAGE_PNG_VALUE`.
  - Accepts optional query parameters: `width` (default 300), `height` (default 100).
- `GET /api/lots/{lotId}/barcode-image`:
  - Retrieves lot barcode by `lotId` (using `InventoryLotRepository`).
  - Returns barcode PNG with `MediaType.IMAGE_PNG_VALUE`.
  - Throws 404 / `NoSuchElementException` if lot not found.

### 3. Tests (`backend/src/test/java/com/alamin/pos/service/BarcodeServiceTest.java`)
- Test barcode PNG byte generation for valid code (e.g. `SYN-AMI-202601`).
- Verify generated PNG header starts with standard PNG magic bytes (`0x89, 'P', 'N', 'G'`).
- Test decoding the generated barcode image using ZXing `MultiFormatReader` to verify the generated image scans back to the exact original string! (Round-trip verification test).
- Test invalid/blank input handling.
- Test controller endpoints (`/api/barcode/{barcode}` and `/api/lots/{id}/barcode-image`) via MockMvc or SpringBootTest.

## Verification Command
Run in `backend/`:
`./gradlew test --tests BarcodeServiceTest`
Ensure it compiles, executes, and passes with 0 errors.

## Reporting
- Commit changes: `feat: implement zxing barcode generation engine`
- Write report to: `.superpowers/sdd/pos-inventory-syngenta/task-5-report.md`
- Report back with DONE, commit hash, and test verification output.
