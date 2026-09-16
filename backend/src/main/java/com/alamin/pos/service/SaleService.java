package com.alamin.pos.service;

import com.alamin.pos.dto.SaleItemRequest;
import com.alamin.pos.dto.SaleItemResponse;
import com.alamin.pos.dto.SaleRequest;
import com.alamin.pos.dto.SaleResponse;
import com.alamin.pos.entity.Customer;
import com.alamin.pos.entity.CustomerLedger;
import com.alamin.pos.entity.GodownMovement;
import com.alamin.pos.entity.InventoryLot;
import com.alamin.pos.entity.Product;
import com.alamin.pos.entity.Sale;
import com.alamin.pos.entity.SaleItem;
import com.alamin.pos.entity.StockInventory;
import com.alamin.pos.repository.CustomerLedgerRepository;
import com.alamin.pos.repository.CustomerRepository;
import com.alamin.pos.repository.GodownMovementRepository;
import com.alamin.pos.repository.InventoryLotRepository;
import com.alamin.pos.repository.SaleItemRepository;
import com.alamin.pos.repository.SaleRepository;
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
public class SaleService {

    private final SaleRepository saleRepository;
    private final SaleItemRepository saleItemRepository;
    private final InventoryLotRepository inventoryLotRepository;
    private final StockInventoryRepository stockInventoryRepository;
    private final CustomerRepository customerRepository;
    private final CustomerLedgerRepository customerLedgerRepository;
    private final GodownMovementRepository godownMovementRepository;

    @Transactional
    public SaleResponse processSale(SaleRequest request) {
        if (request.getItems() == null || request.getItems().isEmpty()) {
            throw new IllegalArgumentException("Sale must have at least one item");
        }
        if (request.getSaleMode() == null || request.getSaleMode().isBlank()) {
            throw new IllegalArgumentException("Sale mode is required");
        }

        Customer customer = null;
        if (request.getCustomerId() != null) {
            customer = customerRepository.findById(request.getCustomerId())
                    .orElseThrow(() -> new IllegalArgumentException("Customer not found with id: " + request.getCustomerId()));
        }

        // BUSINESS DECISION: Invoice numbers are generated using INV-YYYYMMDD-XXXX format ensuring daily readability and uniqueness.
        String datePart = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String invoiceNo;
        do {
            int randomNum = ThreadLocalRandom.current().nextInt(1000, 10000);
            invoiceNo = "INV-" + datePart + "-" + randomNum;
        } while (saleRepository.findByInvoiceNo(invoiceNo).isPresent());

        List<SaleItem> saleItems = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

        for (SaleItemRequest itemReq : request.getItems()) {
            InventoryLot lot = inventoryLotRepository.findById(itemReq.getLotId())
                    .orElseThrow(() -> new IllegalArgumentException("Lot not found with id: " + itemReq.getLotId()));

            BigDecimal totalQty = itemReq.getTotalQuantity().setScale(3, RoundingMode.HALF_UP);
            if (totalQty.compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException("Total quantity must be greater than zero for lot " + lot.getLotNumber());
            }

            // BUSINESS DECISION: Default split deduction when unspecified assigns entire quantity to Dokan counter stock; partial specification auto-balances to fulfill total quantity.
            BigDecimal dokanQty = itemReq.getDokanQuantity();
            BigDecimal godownQty = itemReq.getGodownQuantity();

            if (dokanQty == null && godownQty == null) {
                dokanQty = totalQty;
                godownQty = BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP);
            } else if (dokanQty == null) {
                dokanQty = totalQty.subtract(godownQty).setScale(3, RoundingMode.HALF_UP);
            } else if (godownQty == null) {
                godownQty = totalQty.subtract(dokanQty).setScale(3, RoundingMode.HALF_UP);
            } else {
                dokanQty = dokanQty.setScale(3, RoundingMode.HALF_UP);
                godownQty = godownQty.setScale(3, RoundingMode.HALF_UP);
            }

            if (dokanQty.add(godownQty).compareTo(totalQty) != 0) {
                throw new IllegalArgumentException("Split quantities (Dokan: " + dokanQty + ", Godown: " + godownQty + ") must equal total quantity: " + totalQty);
            }
            if (dokanQty.compareTo(BigDecimal.ZERO) < 0 || godownQty.compareTo(BigDecimal.ZERO) < 0) {
                throw new IllegalArgumentException("Split quantities cannot be negative");
            }

            // 1. Deduct Dokan stock
            if (dokanQty.compareTo(BigDecimal.ZERO) > 0) {
                StockInventory dokanStock = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "DOKAN")
                        .orElseGet(() -> StockInventory.builder()
                                .lot(lot)
                                .location("DOKAN")
                                .quantity(BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP))
                                .build());
                // BUSINESS DECISION: Allow Dokan counter stock to go negative to support ringing up newly arrived goods before supplier challan entry.
                dokanStock.setQuantity(dokanStock.getQuantity().subtract(dokanQty).setScale(3, RoundingMode.HALF_UP));
                stockInventoryRepository.save(dokanStock);
            }

            // 2. Deduct Godown stock
            if (godownQty.compareTo(BigDecimal.ZERO) > 0) {
                StockInventory godownStock = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "GODOWN")
                        .orElseThrow(() -> new IllegalArgumentException("Insufficient Godown stock for lot " + lot.getLotNumber()));
                // BUSINESS DECISION: Strictly prevent negative inventory in Godown bulk storage to protect physical warehouse audit counts.
                if (godownStock.getQuantity().compareTo(godownQty) < 0) {
                    throw new IllegalArgumentException("Insufficient Godown stock for lot " + lot.getLotNumber());
                }
                godownStock.setQuantity(godownStock.getQuantity().subtract(godownQty).setScale(3, RoundingMode.HALF_UP));
                stockInventoryRepository.save(godownStock);

                // BUSINESS DECISION: Audit log direct wholesale dispatches from Godown as DIRECT_WHOLESALE_DISPATCH in godown_movement.
                GodownMovement movement = GodownMovement.builder()
                        .lot(lot)
                        .movementType("DIRECT_WHOLESALE_DISPATCH")
                        .quantity(godownQty)
                        .movementDate(LocalDateTime.now())
                        .referenceNo(invoiceNo)
                        .remarks("Direct wholesale dispatch from Godown for invoice " + invoiceNo)
                        .build();
                godownMovementRepository.save(movement);
            }

            // BUSINESS DECISION: Freeze unit_cost = lot.purchaseCost on sale_item snapshot to permanently preserve historical gross profit margins.
            BigDecimal unitCost = lot.getPurchaseCost().setScale(2, RoundingMode.HALF_UP);
            BigDecimal unitPrice = itemReq.getUnitPrice().setScale(2, RoundingMode.HALF_UP);
            BigDecimal itemSubtotal = unitPrice.multiply(totalQty).setScale(2, RoundingMode.HALF_UP);
            subtotal = subtotal.add(itemSubtotal).setScale(2, RoundingMode.HALF_UP);

            SaleItem saleItem = SaleItem.builder()
                    .lot(lot)
                    .totalQuantity(totalQty)
                    .dokanQuantity(dokanQty)
                    .godownQuantity(godownQty)
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

        BigDecimal cashPaid = request.getCashPaid() != null
                ? request.getCashPaid().setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

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
                throw new IllegalArgumentException("Cannot have due amount for anonymous walk-in customer");
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
                .setScale(2, RoundingMode.HALF_UP);

        return mapToResponse(savedSale, savedItems, totalProfit);
    }

    @Transactional(readOnly = true)
    public SaleResponse getSaleById(Long id) {
        Sale sale = saleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Sale not found with id: " + id));
        List<SaleItem> items = saleItemRepository.findBySaleId(sale.getId());
        return mapToResponse(sale, items);
    }

    @Transactional(readOnly = true)
    public SaleResponse getSaleByInvoiceNo(String invoiceNo) {
        Sale sale = saleRepository.findByInvoiceNo(invoiceNo)
                .orElseThrow(() -> new IllegalArgumentException("Sale not found with invoice no: " + invoiceNo));
        List<SaleItem> items = saleItemRepository.findBySaleId(sale.getId());
        return mapToResponse(sale, items);
    }

    @Transactional(readOnly = true)
    public List<SaleResponse> getRecentSales(int limit) {
        Pageable pageable = PageRequest.of(0, limit > 0 ? limit : 50);
        List<Sale> sales = saleRepository.findAllByOrderBySaleDateDesc(pageable);
        return sales.stream()
                .map(sale -> {
                    List<SaleItem> items = saleItemRepository.findBySaleId(sale.getId());
                    return mapToResponse(sale, items);
                })
                .toList();
    }

    private SaleResponse mapToResponse(Sale sale, List<SaleItem> items) {
        BigDecimal totalProfit = items.stream()
                .map(item -> item.getUnitPrice().subtract(item.getUnitCost()).multiply(item.getTotalQuantity()))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .subtract(sale.getDiscount() != null ? sale.getDiscount() : BigDecimal.ZERO)
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
                            .dokanQuantity(item.getDokanQuantity())
                            .godownQuantity(item.getGodownQuantity())
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
