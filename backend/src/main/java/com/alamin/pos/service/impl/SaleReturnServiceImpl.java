package com.alamin.pos.service.impl;

import com.alamin.pos.dto.SaleReturnItemDto;
import com.alamin.pos.dto.SaleReturnItemRequest;
import com.alamin.pos.dto.SaleReturnRequest;
import com.alamin.pos.dto.SaleReturnResponse;
import com.alamin.pos.entity.Customer;
import com.alamin.pos.entity.CustomerLedger;
import com.alamin.pos.entity.InventoryLot;
import com.alamin.pos.entity.Product;
import com.alamin.pos.entity.Sale;
import com.alamin.pos.entity.SaleReturn;
import com.alamin.pos.entity.SaleReturnItem;
import com.alamin.pos.entity.SaleItem;
import com.alamin.pos.entity.StockInventory;
import com.alamin.pos.exception.BusinessRuleViolationException;
import com.alamin.pos.exception.InvalidReturnException;
import com.alamin.pos.exception.ResourceNotFoundException;
import com.alamin.pos.exception.ValidationException;
import com.alamin.pos.repository.CustomerLedgerRepository;
import com.alamin.pos.repository.CustomerRepository;
import com.alamin.pos.repository.InventoryLotRepository;
import com.alamin.pos.repository.SaleItemRepository;
import com.alamin.pos.repository.SaleRepository;
import com.alamin.pos.repository.SaleReturnItemRepository;
import com.alamin.pos.repository.SaleReturnRepository;
import com.alamin.pos.repository.StockInventoryRepository;
import com.alamin.pos.service.DocumentSequenceService;
import com.alamin.pos.service.SaleReturnService;
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

import com.alamin.pos.entity.StockMovement;
import com.alamin.pos.repository.StockMovementRepository;

@Slf4j
@Service
@RequiredArgsConstructor
public class SaleReturnServiceImpl implements SaleReturnService {

    private final SaleReturnRepository saleReturnRepository;
    private final SaleReturnItemRepository saleReturnItemRepository;
    private final SaleRepository saleRepository;
    private final SaleItemRepository saleItemRepository;
    private final CustomerRepository customerRepository;
    private final CustomerLedgerRepository customerLedgerRepository;
    private final InventoryLotRepository inventoryLotRepository;
    private final StockInventoryRepository stockInventoryRepository;
    private final DocumentSequenceService documentSequenceService;
    private final StockMovementRepository stockMovementRepository;

    @Override
    @Transactional
    public SaleReturnResponse processReturn(SaleReturnRequest request) {
        if (request.getItems() == null || request.getItems().isEmpty()) {
            throw new ValidationException("Sale return must have at least one item");
        }
        if (request.getRefundType() == null || request.getRefundType().isBlank()) {
            throw new ValidationException("Refund type is required");
        }

        String refundType = request.getRefundType().trim().toUpperCase();
        if (!"CASH_REFUND".equals(refundType) && !"DUE_ADJUSTMENT".equals(refundType)) {
            throw new ValidationException("Invalid refund type: " + refundType + ". Expected CASH_REFUND or DUE_ADJUSTMENT");
        }

        final Sale originalSale = (request.getOriginalSaleId() != null)
                ? saleRepository.findById(request.getOriginalSaleId())
                        .orElseThrow(() -> new ResourceNotFoundException("Original sale not found with id: " + request.getOriginalSaleId()))
                : null;

        Customer customer = null;
        if (request.getCustomerId() != null) {
            customer = customerRepository.findByIdForUpdate(request.getCustomerId())
                    .orElseThrow(() -> new ResourceNotFoundException("Customer not found with id: " + request.getCustomerId()));
        } else if (originalSale != null && originalSale.getCustomer() != null) {
            customer = customerRepository.findByIdForUpdate(originalSale.getCustomer().getId())
                    .orElse(originalSale.getCustomer());
        }

        if ("DUE_ADJUSTMENT".equals(refundType) && customer == null) {
            throw new BusinessRuleViolationException("Customer is required for DUE_ADJUSTMENT refund");
        }

        String returnNo = documentSequenceService.generateReturnNumber();

        List<SaleReturnItem> returnItems = new ArrayList<>();
        BigDecimal totalRefundAmount = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

        // If original sale is provided, fetch original items for return validation
        List<SaleItem> originalSaleItems = null;
        if (originalSale != null) {
            originalSaleItems = saleItemRepository.findBySaleId(originalSale.getId());
        }

        for (SaleReturnItemRequest itemReq : request.getItems()) {
            InventoryLot lot = inventoryLotRepository.findById(itemReq.getLotId())
                    .orElseThrow(() -> new ResourceNotFoundException("Lot not found with id: " + itemReq.getLotId()));

            BigDecimal qty = itemReq.getQuantity() != null
                    ? itemReq.getQuantity().setScale(3, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP);
            if (qty.compareTo(BigDecimal.ZERO) <= 0) {
                throw new ValidationException("Return quantity must be greater than zero");
            }

            BigDecimal refundPrice = itemReq.getRefundPrice() != null
                    ? itemReq.getRefundPrice().setScale(2, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

            // Strict invoice-linked return validation
            if (originalSale != null && originalSaleItems != null) {
                SaleItem matchingOriginalItem = originalSaleItems.stream()
                        .filter(si -> si.getLot().getId().equals(lot.getId()))
                        .findFirst()
                        .orElseThrow(() -> new InvalidReturnException("Lot " + lot.getLotNumber() + " was not part of original invoice " + originalSale.getInvoiceNo()));

                // Calculate cumulative previously returned quantity for this lot from originalSale
                List<SaleReturn> previousReturns = saleReturnRepository.findByOriginalSaleId(originalSale.getId());
                BigDecimal previouslyReturned = BigDecimal.ZERO;
                for (SaleReturn prev : previousReturns) {
                    List<SaleReturnItem> prevItems = saleReturnItemRepository.findBySaleReturnId(prev.getId());
                    for (SaleReturnItem pi : prevItems) {
                        if (pi.getLot().getId().equals(lot.getId())) {
                            previouslyReturned = previouslyReturned.add(pi.getQuantity());
                        }
                    }
                }

                BigDecimal remainingReturnable = matchingOriginalItem.getTotalQuantity().subtract(previouslyReturned);
                if (qty.compareTo(remainingReturnable) > 0) {
                    throw new InvalidReturnException("Return quantity " + qty + " exceeds remaining returnable quantity (" + remainingReturnable + ") for lot " + lot.getLotNumber() + " on invoice " + originalSale.getInvoiceNo());
                }

                if (refundPrice.compareTo(BigDecimal.ZERO) == 0) {
                    refundPrice = matchingOriginalItem.getUnitPrice();
                }
            }

            if (refundPrice.compareTo(BigDecimal.ZERO) < 0) {
                throw new ValidationException("Refund price cannot be negative");
            }

            BigDecimal lineRefund = refundPrice.multiply(qty).setScale(2, RoundingMode.HALF_UP);
            totalRefundAmount = totalRefundAmount.add(lineRefund);

            boolean isDamaged = Boolean.TRUE.equals(itemReq.getIsDamaged());
            String location = isDamaged ? "QUARANTINE" : "DOKAN";

            StockInventory stock = stockInventoryRepository.findByLotIdAndLocationForUpdate(lot.getId(), location)
                    .orElseGet(() -> StockInventory.builder()
                            .lot(lot)
                            .location(location)
                            .quantity(BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP))
                            .build());
            BigDecimal beforeStock = stock.getQuantity() != null ? stock.getQuantity() : BigDecimal.ZERO;
            BigDecimal afterStock = beforeStock.add(qty).setScale(3, RoundingMode.HALF_UP);
            stock.setQuantity(afterStock);
            stockInventoryRepository.save(stock);

            // Immutable Bin Card audit record
            stockMovementRepository.save(StockMovement.builder()
                    .product(lot.getProduct())
                    .lot(lot)
                    .movementTime(LocalDateTime.now())
                    .movementType(isDamaged ? "RETURN_QUARANTINED" : "RETURN_RESTOCKED")
                    .location(location)
                    .quantityChange(qty)
                    .balanceBefore(beforeStock)
                    .balanceAfter(afterStock)
                    .unit(lot.getProduct() != null ? lot.getProduct().getBaseUnit() : "Unit")
                    .referenceDocNo(returnNo)
                    .remarks((isDamaged ? "Damaged chemical return (Quarantined)" : "Customer return (Restocked)") + (customer != null ? " from " + customer.getName() : ""))
                    .performedBy("Cashier")
                    .build());

            if (isDamaged) {
                log.info("Quarantined damaged return item for lot {} (quantity: {}) into QUARANTINE stock", lot.getLotNumber(), qty);
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

        if (customer != null) {
            BigDecimal currentTotal = customer.getTotalPurchases() != null ? customer.getTotalPurchases() : BigDecimal.ZERO;
            customer.setTotalPurchases(currentTotal.subtract(totalRefundAmount).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP));
            if ("DUE_ADJUSTMENT".equals(refundType)) {
                // BUSINESS DECISION: Direct returns with DUE_ADJUSTMENT credit customer ledger with RETURN_CREDIT, reducing outstanding customer debt.
                BigDecimal newDue = customer.getCurrentDue().subtract(totalRefundAmount).setScale(2, RoundingMode.HALF_UP);
                customer.setCurrentDue(newDue);
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
            customerRepository.save(customer);
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

    @Override
    @Transactional(readOnly = true)
    public SaleReturnResponse getReturnById(Long id) {
        SaleReturn saleReturn = saleReturnRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Sale return not found with id: " + id));
        List<SaleReturnItem> items = saleReturnItemRepository.findBySaleReturnId(saleReturn.getId());
        return mapToResponse(saleReturn, items);
    }

    @Override
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
