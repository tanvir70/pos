package com.alamin.pos.service.impl;

import com.alamin.pos.dto.PagedResponse;
import com.alamin.pos.dto.SaleItemRequest;
import com.alamin.pos.dto.SaleItemResponse;
import com.alamin.pos.dto.SaleRequest;
import com.alamin.pos.dto.SaleResponse;
import org.springframework.data.domain.Page;
import com.alamin.pos.entity.Customer;
import com.alamin.pos.entity.CustomerLedger;
import com.alamin.pos.entity.InventoryLot;
import com.alamin.pos.entity.Product;
import com.alamin.pos.entity.Sale;
import com.alamin.pos.entity.SaleItem;
import com.alamin.pos.entity.StockInventory;
import com.alamin.pos.exception.BusinessRuleViolationException;
import com.alamin.pos.exception.ExpiredLotSaleException;
import com.alamin.pos.exception.InsufficientStockException;
import com.alamin.pos.exception.ResourceNotFoundException;
import com.alamin.pos.exception.ValidationException;
import com.alamin.pos.repository.CustomerLedgerRepository;
import com.alamin.pos.repository.CustomerRepository;
import com.alamin.pos.repository.InventoryLotRepository;
import com.alamin.pos.repository.SaleItemRepository;
import com.alamin.pos.repository.SaleRepository;
import com.alamin.pos.repository.StockInventoryRepository;
import com.alamin.pos.service.DocumentSequenceService;
import com.alamin.pos.service.SaleService;
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
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SaleServiceImpl implements SaleService {

    private final SaleRepository saleRepository;
    private final SaleItemRepository saleItemRepository;
    private final InventoryLotRepository inventoryLotRepository;
    private final StockInventoryRepository stockInventoryRepository;
    private final CustomerRepository customerRepository;
    private final CustomerLedgerRepository customerLedgerRepository;
    private final DocumentSequenceService documentSequenceService;

    @Override
    @Transactional
    public SaleResponse processSale(SaleRequest request) {
        if (request.getItems() == null || request.getItems().isEmpty()) {
            throw new ValidationException("Sale must have at least one item");
        }
        if (request.getSaleMode() == null || request.getSaleMode().isBlank()) {
            throw new ValidationException("Sale mode is required");
        }

        Customer customer = null;
        if (request.getCustomerId() != null) {
            customer = customerRepository.findByIdForUpdate(request.getCustomerId())
                    .orElseThrow(() -> new ResourceNotFoundException("Customer not found with id: " + request.getCustomerId()));
        }

        String invoiceNo = documentSequenceService.generateInvoiceNumber();

        List<SaleItem> saleItems = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

        for (SaleItemRequest itemReq : request.getItems()) {
            InventoryLot lot = inventoryLotRepository.findById(itemReq.getLotId())
                    .orElseThrow(() -> new ResourceNotFoundException("Lot not found with id: " + itemReq.getLotId()));

            // Agrochemical Regulatory Compliance: Pesticide Ordinance 1971
            if (lot.getExpiryDate() != null && lot.getExpiryDate().isBefore(LocalDate.now())) {
                throw new ExpiredLotSaleException("Cannot sell expired lot " + lot.getLotNumber() + " (expired on " + lot.getExpiryDate() + "). Agrochemical regulatory violation under Pesticide Ordinance 1971.");
            }

            // FEFO audit: check if older unexpired lot exists with positive stock
            if (lot.getProduct() != null && lot.getExpiryDate() != null) {
                List<InventoryLot> fefoLots = inventoryLotRepository.findByProductIdOrderByExpiryDateAsc(lot.getProduct().getId());
                for (InventoryLot earlierLot : fefoLots) {
                    if (earlierLot.getExpiryDate() != null
                            && earlierLot.getExpiryDate().isBefore(lot.getExpiryDate())
                            && !earlierLot.getExpiryDate().isBefore(LocalDate.now())) {
                        BigDecimal available = stockInventoryRepository.findByLotId(earlierLot.getId()).stream()
                                .map(StockInventory::getQuantity)
                                .reduce(BigDecimal.ZERO, BigDecimal::add);
                        if (available.compareTo(BigDecimal.ZERO) > 0) {
                            log.warn("REGULATORY FEFO WARNING: Product {} ({}) has older unexpired lot {} (expires {}, available: {}) but cashier selected lot {} (expires {})",
                                    lot.getProduct().getProductCode(), lot.getProduct().getNameEn(),
                                    earlierLot.getLotNumber(), earlierLot.getExpiryDate(), available,
                                    lot.getLotNumber(), lot.getExpiryDate());
                            break;
                        }
                    }
                }
            }

            BigDecimal totalQty = itemReq.getTotalQuantity().setScale(3, RoundingMode.HALF_UP);
            if (totalQty.compareTo(BigDecimal.ZERO) <= 0) {
                throw new ValidationException("Total quantity must be greater than zero for lot " + lot.getLotNumber());
            }

            // BUSINESS DECISION: Deduct total sale quantity from active DOKAN counter stock. Dokan stock can go negative to allow ringing up arriving goods before paper challan entry.
            StockInventory dokanStock = stockInventoryRepository.findByLotIdAndLocationForUpdate(lot.getId(), "DOKAN")
                    .orElseGet(() -> StockInventory.builder()
                            .lot(lot)
                            .location("DOKAN")
                            .quantity(BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP))
                            .build());
            dokanStock.setQuantity(dokanStock.getQuantity().subtract(totalQty).setScale(3, RoundingMode.HALF_UP));
            stockInventoryRepository.save(dokanStock);

            // BUSINESS DECISION: Freeze unit_cost = lot.purchaseCost on sale_item snapshot to permanently preserve historical gross profit margins.
            BigDecimal unitCost = lot.getPurchaseCost().setScale(2, RoundingMode.HALF_UP);
            BigDecimal unitPrice = itemReq.getUnitPrice().setScale(2, RoundingMode.HALF_UP);
            BigDecimal itemSubtotal = unitPrice.multiply(totalQty).setScale(2, RoundingMode.HALF_UP);
            subtotal = subtotal.add(itemSubtotal).setScale(2, RoundingMode.HALF_UP);

            SaleItem saleItem = SaleItem.builder()
                    .lot(lot)
                    .totalQuantity(totalQty)
                    .unitPrice(unitPrice)
                    .unitCost(unitCost)
                    .subtotal(itemSubtotal)
                    .build();
            saleItems.add(saleItem);
        }

        BigDecimal discount = request.getDiscount() != null
                ? request.getDiscount().setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

        BigDecimal roundOff = request.getRoundOff() != null
                ? request.getRoundOff().setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

        // BUSINESS DECISION: Round-off adjustment is deducted from invoice total alongside discount to zero out small change without distorting line item unit pricing.
        BigDecimal totalAmount = subtotal.subtract(discount).subtract(roundOff).setScale(2, RoundingMode.HALF_UP);
        if (totalAmount.compareTo(BigDecimal.ZERO) < 0) {
            throw new ValidationException("Discount and round-off (" + discount.add(roundOff) + ") cannot exceed subtotal (" + subtotal + ")");
        }

        BigDecimal cashPaid = request.getCashPaid() != null
                ? request.getCashPaid().setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

        BigDecimal cashTendered = request.getCashTendered() != null && request.getCashTendered().compareTo(BigDecimal.ZERO) > 0
                ? request.getCashTendered().setScale(2, RoundingMode.HALF_UP)
                : cashPaid;

        BigDecimal changeAmount = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        if (cashTendered.compareTo(cashPaid) > 0) {
            changeAmount = cashTendered.subtract(cashPaid).setScale(2, RoundingMode.HALF_UP);
        }

        BigDecimal digitalPaid = request.getDigitalPaid() != null
                ? request.getDigitalPaid().setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

        BigDecimal totalPaid = cashPaid.add(digitalPaid).setScale(2, RoundingMode.HALF_UP);
        BigDecimal dueAmount = totalAmount.subtract(totalPaid).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);

        String paymentMethod = (request.getPaymentMethod() != null && !request.getPaymentMethod().isBlank())
                ? request.getPaymentMethod() : "CASH";

        Sale sale = Sale.builder()
                .invoiceNo(invoiceNo)
                .saleDate(LocalDateTime.now())
                .customer(customer)
                .saleMode(request.getSaleMode().trim().toUpperCase())
                .subtotal(subtotal)
                .discount(discount)
                .roundOff(roundOff)
                .totalAmount(totalAmount)
                .paymentMethod(paymentMethod)
                .cashPaid(cashPaid)
                .cashTendered(cashTendered)
                .changeAmount(changeAmount)
                .digitalPaid(digitalPaid)
                .digitalMedium(request.getDigitalMedium())
                .digitalTrxId(request.getDigitalTrxId())
                .dueAmount(dueAmount)
                .cashierName(request.getCashierName())
                .build();

        Sale savedSale = saleRepository.save(sale);

        for (SaleItem item : saleItems) {
            item.setSale(savedSale);
        }
        List<SaleItem> savedItems = saleItemRepository.saveAll(saleItems);

        // Customer due and ledger management
        if (dueAmount.compareTo(BigDecimal.ZERO) > 0) {
            if (customer == null) {
                throw new BusinessRuleViolationException("Cannot have due amount for anonymous walk-in customer");
            }

            // BUSINESS DECISION: Allow sales to proceed with warning when customer credit limit is exceeded, reflecting Bangladeshi agrochemical trade where credit is extended based on personal trust and upcoming harvest seasons.
            if (customer.getCreditLimit() != null && customer.getCreditLimit().compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal projectedDue = customer.getCurrentDue().add(dueAmount);
                if (projectedDue.compareTo(customer.getCreditLimit()) > 0) {
                    log.warn("Customer {} ({}) exceeded credit limit of {} with new projected due of {}",
                            customer.getName(), customer.getPhone(), customer.getCreditLimit(), projectedDue);
                }
            }

            customer.setCurrentDue(customer.getCurrentDue().add(dueAmount).setScale(2, RoundingMode.HALF_UP));
            customerRepository.save(customer);

            CustomerLedger ledger = CustomerLedger.builder()
                    .customer(customer)
                    .transactionDate(LocalDateTime.now())
                    .transactionType("INVOICE_BILL")
                    .debit(dueAmount)
                    .credit(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP))
                    .balanceAfter(customer.getCurrentDue())
                    .saleId(savedSale.getId())
                    .notes("Invoice bill " + savedSale.getInvoiceNo() + " credit balance")
                    .build();
            customerLedgerRepository.save(ledger);
        }

        BigDecimal totalProfit = savedItems.stream()
                .map(item -> item.getUnitPrice().subtract(item.getUnitCost()).multiply(item.getTotalQuantity()))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .subtract(discount)
                .subtract(roundOff)
                .setScale(2, RoundingMode.HALF_UP);

        return mapToResponse(savedSale, savedItems, totalProfit);
    }

    @Override
    @Transactional(readOnly = true)
    public SaleResponse getSaleById(Long id) {
        Sale sale = saleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Sale not found with id: " + id));
        List<SaleItem> items = saleItemRepository.findBySaleId(sale.getId());
        return mapToResponse(sale, items);
    }

    @Override
    @Transactional(readOnly = true)
    public SaleResponse getSaleByInvoiceNo(String invoiceNo) {
        Sale sale = saleRepository.findByInvoiceNo(invoiceNo)
                .orElseThrow(() -> new ResourceNotFoundException("Sale not found with invoice no: " + invoiceNo));
        List<SaleItem> items = saleItemRepository.findBySaleId(sale.getId());
        return mapToResponse(sale, items);
    }

    @Override
    @Transactional(readOnly = true)
    public List<SaleResponse> getRecentSales(int limit) {
        Pageable pageable = PageRequest.of(0, limit > 0 ? limit : 50);
        List<Sale> sales = saleRepository.findAllByOrderBySaleDateDesc(pageable);
        return mapSalesBatch(sales);
    }

    @Override
    @Transactional(readOnly = true)
    public PagedResponse<SaleResponse> getSales(int page, int size, String period, String saleMode) {
        int pageIndex = Math.max(0, page);
        int pageSize = (size > 0 && size <= 100) ? size : 10;
        Pageable pageable = PageRequest.of(pageIndex, pageSize);

        LocalDateTime startDate = null;
        LocalDateTime endDate = LocalDateTime.now();
        if ("today".equalsIgnoreCase(period)) {
            startDate = LocalDate.now().atStartOfDay();
        } else if ("week".equalsIgnoreCase(period)) {
            startDate = LocalDate.now().minusDays(7).atStartOfDay();
        } else if ("month".equalsIgnoreCase(period)) {
            startDate = LocalDate.now().minusDays(30).atStartOfDay();
        }

        boolean hasMode = saleMode != null && !saleMode.isBlank() && !"ALL".equalsIgnoreCase(saleMode);
        Page<Sale> salesPage;

        if (hasMode && startDate != null) {
            salesPage = saleRepository.findBySaleModeAndSaleDateBetween(saleMode.toUpperCase(), startDate, endDate, pageable);
        } else if (hasMode) {
            salesPage = saleRepository.findBySaleMode(saleMode.toUpperCase(), pageable);
        } else if (startDate != null) {
            salesPage = saleRepository.findBySaleDateBetween(startDate, endDate, pageable);
        } else {
            salesPage = saleRepository.findAllBy(pageable);
        }

        List<SaleResponse> mapped = mapSalesBatch(salesPage.getContent());

        return PagedResponse.<SaleResponse>builder()
                .content(mapped)
                .pageNumber(salesPage.getNumber())
                .pageSize(salesPage.getSize())
                .totalElements(salesPage.getTotalElements())
                .totalPages(salesPage.getTotalPages())
                .first(salesPage.isFirst())
                .last(salesPage.isLast())
                .build();
    }

    private List<SaleResponse> mapSalesBatch(List<Sale> sales) {
        if (sales == null || sales.isEmpty()) {
            return List.of();
        }
        List<Long> saleIds = sales.stream().map(Sale::getId).toList();
        List<SaleItem> allItems = saleItemRepository.findBySaleIdInWithLotAndProduct(saleIds);
        Map<Long, List<SaleItem>> itemsBySale = allItems.stream()
                .collect(Collectors.groupingBy(item -> item.getSale().getId()));

        return sales.stream()
                .map(sale -> {
                    List<SaleItem> items = itemsBySale.getOrDefault(sale.getId(), List.of());
                    return mapToResponse(sale, items);
                })
                .toList();
    }

    private SaleResponse mapToResponse(Sale sale, List<SaleItem> items) {
        BigDecimal totalProfit = items.stream()
                .map(item -> item.getUnitPrice().subtract(item.getUnitCost()).multiply(item.getTotalQuantity()))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .subtract(sale.getDiscount() != null ? sale.getDiscount() : BigDecimal.ZERO)
                .subtract(sale.getRoundOff() != null ? sale.getRoundOff() : BigDecimal.ZERO)
                .setScale(2, RoundingMode.HALF_UP);
        return mapToResponse(sale, items, totalProfit);
    }

    private SaleResponse mapToResponse(Sale sale, List<SaleItem> items, BigDecimal totalProfit) {
        Customer customer = sale.getCustomer();
        List<SaleItemResponse> itemResponses = items.stream()
                .map(item -> {
                    InventoryLot lot = item.getLot();
                    Product product = lot != null ? lot.getProduct() : null;
                    BigDecimal lineProfit = item.getUnitPrice().subtract(item.getUnitCost())
                            .multiply(item.getTotalQuantity())
                            .setScale(2, RoundingMode.HALF_UP);

                    return SaleItemResponse.builder()
                            .id(item.getId())
                            .lotId(lot != null ? lot.getId() : null)
                            .lotNumber(lot != null ? lot.getLotNumber() : null)
                            .barcode(lot != null ? lot.getBarcode() : null)
                            .productNameEn(product != null ? product.getNameEn() : null)
                            .productNameBn(product != null ? product.getNameBn() : null)
                            .totalQuantity(item.getTotalQuantity())
                            .unitPrice(item.getUnitPrice())
                            .unitCost(item.getUnitCost())
                            .subtotal(item.getSubtotal())
                            .lineProfit(lineProfit)
                            .build();
                })
                .toList();

        return SaleResponse.builder()
                .id(sale.getId())
                .invoiceNo(sale.getInvoiceNo())
                .saleDate(sale.getSaleDate())
                .customerId(customer != null ? customer.getId() : null)
                .customerName(customer != null ? customer.getName() : null)
                .customerPhone(customer != null ? customer.getPhone() : null)
                .saleMode(sale.getSaleMode())
                .subtotal(sale.getSubtotal())
                .discount(sale.getDiscount())
                .roundOff(sale.getRoundOff())
                .totalAmount(sale.getTotalAmount())
                .paymentMethod(sale.getPaymentMethod())
                .cashPaid(sale.getCashPaid())
                .cashTendered(sale.getCashTendered())
                .changeAmount(sale.getChangeAmount())
                .digitalPaid(sale.getDigitalPaid())
                .digitalMedium(sale.getDigitalMedium())
                .digitalTrxId(sale.getDigitalTrxId())
                .dueAmount(sale.getDueAmount())
                .cashierName(sale.getCashierName())
                .totalProfit(totalProfit)
                .items(itemResponses)
                .build();
    }
}
