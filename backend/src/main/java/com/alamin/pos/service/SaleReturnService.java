package com.alamin.pos.service;

import com.alamin.pos.dto.SaleReturnItemDto;
import com.alamin.pos.dto.SaleReturnItemRequest;
import com.alamin.pos.dto.SaleReturnRequest;
import com.alamin.pos.dto.SaleReturnResponse;
import com.alamin.pos.entity.Customer;
import com.alamin.pos.entity.CustomerLedger;
import com.alamin.pos.entity.GodownMovement;
import com.alamin.pos.entity.InventoryLot;
import com.alamin.pos.entity.Product;
import com.alamin.pos.entity.Sale;
import com.alamin.pos.entity.SaleReturn;
import com.alamin.pos.entity.SaleReturnItem;
import com.alamin.pos.entity.StockInventory;
import com.alamin.pos.repository.CustomerLedgerRepository;
import com.alamin.pos.repository.CustomerRepository;
import com.alamin.pos.repository.GodownMovementRepository;
import com.alamin.pos.repository.InventoryLotRepository;
import com.alamin.pos.repository.SaleRepository;
import com.alamin.pos.repository.SaleReturnItemRepository;
import com.alamin.pos.repository.SaleReturnRepository;
import com.alamin.pos.repository.StockInventoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

@Slf4j
@Service
@RequiredArgsConstructor
public class SaleReturnService {

    private final SaleReturnRepository saleReturnRepository;
    private final SaleReturnItemRepository saleReturnItemRepository;
    private final SaleRepository saleRepository;
    private final CustomerRepository customerRepository;
    private final CustomerLedgerRepository customerLedgerRepository;
    private final InventoryLotRepository inventoryLotRepository;
    private final StockInventoryRepository stockInventoryRepository;
    private final GodownMovementRepository godownMovementRepository;

    @Transactional
    public SaleReturnResponse processReturn(SaleReturnRequest request) {
        if (request.getItems() == null || request.getItems().isEmpty()) {
            throw new IllegalArgumentException("Sale return must have at least one item");
        }
        if (request.getRefundType() == null || request.getRefundType().isBlank()) {
            throw new IllegalArgumentException("Refund type is required");
        }

        String refundType = request.getRefundType().trim().toUpperCase();
        if (!"CASH_REFUND".equals(refundType) && !"DUE_ADJUSTMENT".equals(refundType)) {
            throw new IllegalArgumentException("Invalid refund type: " + refundType + ". Expected CASH_REFUND or DUE_ADJUSTMENT");
        }

        Sale originalSale = null;
        if (request.getOriginalSaleId() != null) {
            originalSale = saleRepository.findById(request.getOriginalSaleId())
                    .orElseThrow(() -> new IllegalArgumentException("Original sale not found with id: " + request.getOriginalSaleId()));
        }

        Customer customer = null;
        if (request.getCustomerId() != null) {
            customer = customerRepository.findById(request.getCustomerId())
                    .orElseThrow(() -> new IllegalArgumentException("Customer not found with id: " + request.getCustomerId()));
        } else if (originalSale != null && originalSale.getCustomer() != null) {
            customer = originalSale.getCustomer();
        }

        if ("DUE_ADJUSTMENT".equals(refundType) && customer == null) {
            throw new IllegalArgumentException("Customer is required for DUE_ADJUSTMENT refund");
        }

        // Synthesize unique return number: RET-YYYYMMDD-XXXX
        String datePart = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String returnNo;
        do {
            int randomNum = ThreadLocalRandom.current().nextInt(1000, 10000);
            returnNo = "RET-" + datePart + "-" + randomNum;
        } while (saleReturnRepository.findByReturnNo(returnNo).isPresent());

        List<SaleReturnItem> returnItems = new ArrayList<>();
        BigDecimal totalRefundAmount = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

        for (SaleReturnItemRequest itemReq : request.getItems()) {
            InventoryLot lot = inventoryLotRepository.findById(itemReq.getLotId())
                    .orElseThrow(() -> new IllegalArgumentException("Lot not found with id: " + itemReq.getLotId()));

            BigDecimal qty = itemReq.getQuantity() != null
                    ? itemReq.getQuantity().setScale(3, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP);
            if (qty.compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException("Return quantity must be greater than zero");
            }

            BigDecimal refundPrice = itemReq.getRefundPrice() != null
                    ? itemReq.getRefundPrice().setScale(2, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
            if (refundPrice.compareTo(BigDecimal.ZERO) < 0) {
                throw new IllegalArgumentException("Refund price cannot be negative");
            }

            BigDecimal lineRefund = refundPrice.multiply(qty).setScale(2, RoundingMode.HALF_UP);
            totalRefundAmount = totalRefundAmount.add(lineRefund);

            boolean isDamaged = Boolean.TRUE.equals(itemReq.getIsDamaged());
            String location = (itemReq.getRestockLocation() != null && !itemReq.getRestockLocation().isBlank())
                    ? itemReq.getRestockLocation().trim().toUpperCase()
                    : "DOKAN";

            if (!isDamaged) {
                StockInventory stock = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), location)
                        .orElseGet(() -> StockInventory.builder()
                                .lot(lot)
                                .location(location)
                                .quantity(BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP))
                                .build());
                stock.setQuantity(stock.getQuantity().add(qty).setScale(3, RoundingMode.HALF_UP));
                stockInventoryRepository.save(stock);

                if ("GODOWN".equals(location)) {
                    GodownMovement movement = GodownMovement.builder()
                            .lot(lot)
                            .movementType("RETURN_ENTRY")
                            .quantity(qty)
                            .movementDate(LocalDateTime.now())
                            .referenceNo(returnNo)
                            .remarks("Sales return restocked to Godown: " + returnNo)
                            .build();
                    godownMovementRepository.save(movement);
                }
            } else {
                // BUSINESS DECISION: Damaged return items are quarantined from sellable Dokan and Godown stock balances.
                log.info("Quarantined damaged return item for lot {} (quantity: {})", lot.getLotNumber(), qty);
            }

            SaleReturnItem item = SaleReturnItem.builder()
                    .lot(lot)
                    .quantity(qty)
                    .refundPrice(refundPrice)
                    .isDamaged(isDamaged)
                    .restockLocation(location)
                    .build();
            returnItems.add(item);
        }

        totalRefundAmount = totalRefundAmount.setScale(2, RoundingMode.HALF_UP);

        if ("DUE_ADJUSTMENT".equals(refundType)) {
            // BUSINESS DECISION: Direct returns with DUE_ADJUSTMENT credit customer ledger with RETURN_CREDIT, reducing outstanding customer debt.
            BigDecimal newDue = customer.getCurrentDue().subtract(totalRefundAmount).setScale(2, RoundingMode.HALF_UP);
            customer.setCurrentDue(newDue);
            customerRepository.save(customer);

            CustomerLedger ledger = CustomerLedger.builder()
                    .customer(customer)
                    .transactionDate(LocalDateTime.now())
                    .transactionType("RETURN_CREDIT")
                    .debit(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP))
                    .credit(totalRefundAmount)
                    .balanceAfter(newDue)
                    .saleId(originalSale != null ? originalSale.getId() : null)
                    .notes("Return Credit: " + returnNo)
                    .build();
            customerLedgerRepository.save(ledger);
        }

        SaleReturn saleReturn = SaleReturn.builder()
                .returnNo(returnNo)
                .originalSale(originalSale)
                .customer(customer)
                .returnDate(LocalDateTime.now())
                .totalRefundAmount(totalRefundAmount)
                .refundType(refundType)
                .reason(request.getReason())
                .build();

        SaleReturn savedReturn = saleReturnRepository.save(saleReturn);

        for (SaleReturnItem item : returnItems) {
            item.setSaleReturn(savedReturn);
        }
        List<SaleReturnItem> savedItems = saleReturnItemRepository.saveAll(returnItems);

        return mapToResponse(savedReturn, savedItems);
    }

    @Transactional(readOnly = true)
    public SaleReturnResponse getReturnById(Long id) {
        SaleReturn saleReturn = saleReturnRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Sale return not found with id: " + id));
        List<SaleReturnItem> items = saleReturnItemRepository.findBySaleReturnId(saleReturn.getId());
        return mapToResponse(saleReturn, items);
    }

    @Transactional(readOnly = true)
    public List<SaleReturnResponse> getRecentReturns(int limit) {
        Pageable pageable = PageRequest.of(0, limit > 0 ? limit : 50);
        List<SaleReturn> returns = saleReturnRepository.findAllByOrderByReturnDateDesc(pageable);
        return returns.stream()
                .map(ret -> {
                    List<SaleReturnItem> items = saleReturnItemRepository.findBySaleReturnId(ret.getId());
                    return mapToResponse(ret, items);
                })
                .toList();
    }

    private SaleReturnResponse mapToResponse(SaleReturn ret, List<SaleReturnItem> items) {
        Customer customer = ret.getCustomer();
        List<SaleReturnItemDto> itemDtos = items.stream()
                .map(item -> {
                    InventoryLot lot = item.getLot();
                    Product product = lot != null ? lot.getProduct() : null;
                    BigDecimal subtotal = item.getRefundPrice().multiply(item.getQuantity()).setScale(2, RoundingMode.HALF_UP);

                    return SaleReturnItemDto.builder()
                            .id(item.getId())
                            .lotId(lot != null ? lot.getId() : null)
                            .lotNumber(lot != null ? lot.getLotNumber() : null)
                            .barcode(lot != null ? lot.getBarcode() : null)
                            .productNameEn(product != null ? product.getNameEn() : null)
                            .productNameBn(product != null ? product.getNameBn() : null)
                            .quantity(item.getQuantity())
                            .refundPrice(item.getRefundPrice())
                            .isDamaged(item.getIsDamaged())
                            .restockLocation(item.getRestockLocation())
                            .subtotal(subtotal)
                            .build();
                })
                .toList();

        return SaleReturnResponse.builder()
                .id(ret.getId())
                .returnNo(ret.getReturnNo())
                .originalSaleId(ret.getOriginalSale() != null ? ret.getOriginalSale().getId() : null)
                .customerId(customer != null ? customer.getId() : null)
                .customerName(customer != null ? customer.getName() : null)
                .customerPhone(customer != null ? customer.getPhone() : null)
                .returnDate(ret.getReturnDate())
                .totalRefundAmount(ret.getTotalRefundAmount())
                .refundType(ret.getRefundType())
                .reason(ret.getReason())
                .items(itemDtos)
                .build();
    }
}
