package com.alamin.pos.repository;

import com.alamin.pos.dto.CustomerDto;
import com.alamin.pos.dto.InventoryLotDto;
import com.alamin.pos.dto.ProductDto;
import com.alamin.pos.entity.Customer;
import com.alamin.pos.entity.CustomerLedger;
import com.alamin.pos.entity.GodownMovement;
import com.alamin.pos.entity.InventoryLot;
import com.alamin.pos.entity.Product;
import com.alamin.pos.entity.Sale;
import com.alamin.pos.entity.SaleItem;
import com.alamin.pos.entity.SaleReturn;
import com.alamin.pos.entity.SaleReturnItem;
import com.alamin.pos.entity.StockInventory;
import com.alamin.pos.mapper.CustomerMapper;
import com.alamin.pos.mapper.InventoryLotMapper;
import com.alamin.pos.mapper.ProductMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class RepositoryTests {

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private InventoryLotRepository inventoryLotRepository;

    @Autowired
    private StockInventoryRepository stockInventoryRepository;

    @Autowired
    private GodownMovementRepository godownMovementRepository;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private CustomerLedgerRepository customerLedgerRepository;

    @Autowired
    private SaleRepository saleRepository;

    @Autowired
    private SaleItemRepository saleItemRepository;

    @Autowired
    private SaleReturnRepository saleReturnRepository;

    @Autowired
    private SaleReturnItemRepository saleReturnItemRepository;

    @Autowired
    private ProductMapper productMapper;

    @Autowired
    private InventoryLotMapper inventoryLotMapper;

    @Autowired
    private CustomerMapper customerMapper;

    @Test
    @DisplayName("Product queries by code, default barcode, and bilingual name search")
    void testProductQueries() {
        Optional<Product> productOpt = productRepository.findByProductCode("SYN-AMI-TOP");
        assertThat(productOpt).isPresent();
        Product product = productOpt.get();
        assertThat(product.getNameEn()).isEqualTo("Amistar Top 325 SC");
        assertThat(product.getNameBn()).isEqualTo("অ্যামিস্টার টপ ৩২৫ এসসি");
        assertThat(product.getCategory()).isEqualTo("Fungicide");
        assertThat(product.getBaseUnit()).isEqualTo("Bottle");
        assertThat(product.getCartonMultiplier()).isEqualByComparingTo("20.000");
        assertThat(product.getStandardRetailPrice()).isEqualByComparingTo("650.00");
        assertThat(product.getStandardWholesalePrice()).isEqualByComparingTo("580.00");

        Optional<Product> barcodeOpt = productRepository.findByDefaultBarcode("SYN-AMI-202601");
        assertThat(barcodeOpt).isPresent();
        assertThat(barcodeOpt.get().getProductCode()).isEqualTo("SYN-AMI-TOP");

        List<Product> searchResults = productRepository.findByNameEnContainingIgnoreCaseOrNameBnContainingIgnoreCase(
                "amistar", "অ্যামিস্টার"
        );
        assertThat(searchResults).isNotEmpty();
        assertThat(searchResults.get(0).getProductCode()).isEqualTo("SYN-AMI-TOP");
    }

    @Test
    @DisplayName("InventoryLot query by barcode and FEFO (First Expired First Out) order")
    void testInventoryLotFefoSorting() {
        Optional<InventoryLot> lotOpt = inventoryLotRepository.findByBarcode("SYN-AMI-202502");
        assertThat(lotOpt).isPresent();
        InventoryLot lot = lotOpt.get();
        assertThat(lot.getLotNumber()).isEqualTo("LOT-2025B2");
        assertThat(lot.getPurchaseCost()).isEqualByComparingTo("500.00");

        // BUSINESS DECISION: FEFO dispatch query must order lots by expiry_date ascending
        Product product = productRepository.findByProductCode("SYN-AMI-TOP").orElseThrow();
        List<InventoryLot> fefoLots = inventoryLotRepository.findByProductIdOrderByExpiryDateAsc(product.getId());

        assertThat(fefoLots).hasSizeGreaterThanOrEqualTo(2);
        // Earlier expiring lot (LOT-2025B2 expiring 2027-12-31) must come before LOT-2026A1 (expiring 2028-06-30)
        assertThat(fefoLots.get(0).getLotNumber()).isEqualTo("LOT-2025B2");
        assertThat(fefoLots.get(0).getExpiryDate()).isEqualTo(LocalDate.of(2027, 12, 31));
        assertThat(fefoLots.get(1).getLotNumber()).isEqualTo("LOT-2026A1");
        assertThat(fefoLots.get(1).getExpiryDate()).isEqualTo(LocalDate.of(2028, 6, 30));
        assertThat(fefoLots.get(0).getExpiryDate()).isBefore(fefoLots.get(1).getExpiryDate());

        List<InventoryLot> allLots = inventoryLotRepository.findByProductId(product.getId());
        assertThat(allLots).hasSizeGreaterThanOrEqualTo(2);
    }

    @Test
    @DisplayName("StockInventory queries for DOKAN and GODOWN allocations")
    void testStockInventoryQueries() {
        InventoryLot lot = inventoryLotRepository.findByBarcode("SYN-AMI-202502").orElseThrow();

        Optional<StockInventory> dokanStock = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "DOKAN");
        assertThat(dokanStock).isPresent();
        assertThat(dokanStock.get().getQuantity()).isEqualByComparingTo("10.000");

        Optional<StockInventory> godownStock = stockInventoryRepository.findByLotIdAndLocation(lot.getId(), "GODOWN");
        assertThat(godownStock).isPresent();
        assertThat(godownStock.get().getQuantity()).isEqualByComparingTo("30.000");

        List<StockInventory> lotInventories = stockInventoryRepository.findByLotId(lot.getId());
        assertThat(lotInventories).hasSize(2);
    }

    @Test
    @DisplayName("GodownMovement query audit history by lot ID")
    void testGodownMovementQuery() {
        InventoryLot lot = inventoryLotRepository.findByBarcode("SYN-AMI-202502").orElseThrow();

        List<GodownMovement> movements = godownMovementRepository.findByLotIdOrderByMovementDateDesc(lot.getId());
        assertThat(movements).isNotEmpty();
        GodownMovement first = movements.get(0);
        assertThat(first.getMovementType()).isEqualTo("PURCHASE_ENTRY");
        assertThat(first.getQuantity()).isEqualByComparingTo("40.000");
        assertThat(first.getReferenceNo()).isEqualTo("CH-SYN-7712");
    }

    @Test
    @DisplayName("Customer queries by phone, search and type")
    void testCustomerQueries() {
        Optional<Customer> wholesaleOpt = customerRepository.findByPhone("01711000001");
        assertThat(wholesaleOpt).isPresent();
        Customer wholesale = wholesaleOpt.get();
        assertThat(wholesale.getName()).isEqualTo("মো: রফিকুল ইসলাম");
        assertThat(wholesale.getBusinessName()).isEqualTo("মেসার্স মদিনা ট্রেডার্স");
        assertThat(wholesale.getCustomerType()).isEqualTo("WHOLESALE");
        assertThat(wholesale.getCreditLimit()).isEqualByComparingTo("100000.00");
        assertThat(wholesale.getCurrentDue()).isEqualByComparingTo("15000.00");
        assertThat(wholesale.getMfsType()).isEqualTo("BKASH");

        List<Customer> searchResults = customerRepository.findByNameContainingIgnoreCaseOrPhoneContaining("রফিকুল", "01711");
        assertThat(searchResults).isNotEmpty();

        List<Customer> wholesaleList = customerRepository.findByCustomerType("WHOLESALE");
        assertThat(wholesaleList).isNotEmpty();

        List<Customer> retailList = customerRepository.findByCustomerType("RETAIL");
        assertThat(retailList).isNotEmpty();
    }

    @Test
    @DisplayName("CustomerLedger queries for transaction history and latest balance")
    void testCustomerLedgerQueries() {
        Customer customer = customerRepository.findByPhone("01711000001").orElseThrow();

        List<CustomerLedger> ledgers = customerLedgerRepository.findByCustomerIdOrderByTransactionDateDesc(customer.getId());
        assertThat(ledgers).isNotEmpty();
        assertThat(ledgers.get(0).getTransactionType()).isEqualTo("INVOICE_BILL");
        assertThat(ledgers.get(0).getDebit()).isEqualByComparingTo("15000.00");
        assertThat(ledgers.get(0).getBalanceAfter()).isEqualByComparingTo("15000.00");

        Optional<CustomerLedger> latestOpt = customerLedgerRepository.findTopByCustomerIdOrderByTransactionDateDescIdDesc(customer.getId());
        assertThat(latestOpt).isPresent();
        assertThat(latestOpt.get().getBalanceAfter()).isEqualByComparingTo("15000.00");
    }

    @Test
    @DisplayName("Sale and SaleItem persistence and repository retrieval")
    void testSaleAndSaleItemPersistence() {
        Customer customer = customerRepository.findByPhone("01711000001").orElseThrow();
        InventoryLot lot = inventoryLotRepository.findByBarcode("SYN-AMI-202502").orElseThrow();

        Sale sale = Sale.builder()
                .invoiceNo("INV-TEST-001")
                .saleDate(LocalDateTime.now())
                .customer(customer)
                .saleMode("WHOLESALE")
                .subtotal(new BigDecimal("5800.00"))
                .discount(BigDecimal.ZERO)
                .roundOff(BigDecimal.ZERO)
                .totalAmount(new BigDecimal("5800.00"))
                .paymentMethod("CASH")
                .cashPaid(new BigDecimal("5800.00"))
                .digitalPaid(BigDecimal.ZERO)
                .dueAmount(BigDecimal.ZERO)
                .cashierName("Al-Amin Admin")
                .build();
        Sale savedSale = saleRepository.save(sale);
        assertThat(savedSale.getId()).isNotNull();

        SaleItem item = SaleItem.builder()
                .sale(savedSale)
                .lot(lot)
                .totalQuantity(new BigDecimal("10.000"))
                .dokanQuantity(new BigDecimal("5.000"))
                .godownQuantity(new BigDecimal("5.000"))
                .unitPrice(new BigDecimal("580.00"))
                .unitCost(new BigDecimal("500.00"))
                .subtotal(new BigDecimal("5800.00"))
                .build();
        SaleItem savedItem = saleItemRepository.save(item);
        assertThat(savedItem.getId()).isNotNull();

        Optional<Sale> queriedSale = saleRepository.findByInvoiceNo("INV-TEST-001");
        assertThat(queriedSale).isPresent();
        assertThat(queriedSale.get().getTotalAmount()).isEqualByComparingTo("5800.00");

        List<Sale> customerSales = saleRepository.findByCustomerIdOrderBySaleDateDesc(customer.getId());
        assertThat(customerSales).isNotEmpty();

        List<SaleItem> saleItems = saleItemRepository.findBySaleId(savedSale.getId());
        assertThat(saleItems).hasSize(1);
        assertThat(saleItems.get(0).getUnitCost()).isEqualByComparingTo("500.00");
    }

    @Test
    @DisplayName("SaleReturn and SaleReturnItem persistence and repository retrieval")
    void testSaleReturnPersistence() {
        Customer customer = customerRepository.findByPhone("01711000001").orElseThrow();
        InventoryLot lot = inventoryLotRepository.findByBarcode("SYN-AMI-202502").orElseThrow();

        SaleReturn saleReturn = SaleReturn.builder()
                .returnNo("RET-TEST-001")
                .customer(customer)
                .returnDate(LocalDateTime.now())
                .totalRefundAmount(new BigDecimal("580.00"))
                .refundType("CASH_REFUND")
                .reason("Farmer changed formulation requirement")
                .build();
        SaleReturn savedReturn = saleReturnRepository.save(saleReturn);
        assertThat(savedReturn.getId()).isNotNull();

        SaleReturnItem returnItem = SaleReturnItem.builder()
                .saleReturn(savedReturn)
                .lot(lot)
                .quantity(new BigDecimal("1.000"))
                .refundPrice(new BigDecimal("580.00"))
                .isDamaged(false)
                .restockLocation("DOKAN")
                .build();
        SaleReturnItem savedItem = saleReturnItemRepository.save(returnItem);
        assertThat(savedItem.getId()).isNotNull();

        Optional<SaleReturn> queriedReturn = saleReturnRepository.findByReturnNo("RET-TEST-001");
        assertThat(queriedReturn).isPresent();
        assertThat(queriedReturn.get().getTotalRefundAmount()).isEqualByComparingTo("580.00");

        List<SaleReturnItem> items = saleReturnItemRepository.findBySaleReturnId(savedReturn.getId());
        assertThat(items).hasSize(1);
        assertThat(items.get(0).getRestockLocation()).isEqualTo("DOKAN");
    }

    @Test
    @DisplayName("MapStruct Mappers: ProductMapper, CustomerMapper, InventoryLotMapper verification")
    void testMapStructMappers() {
        // 1. ProductMapper
        Product product = productRepository.findByProductCode("SYN-AMI-TOP").orElseThrow();
        ProductDto productDto = productMapper.toDto(product);
        assertThat(productDto).isNotNull();
        assertThat(productDto.getProductCode()).isEqualTo("SYN-AMI-TOP");
        assertThat(productDto.getNameEn()).isEqualTo("Amistar Top 325 SC");
        assertThat(productDto.getCartonMultiplier()).isEqualByComparingTo("20.000");

        Product productFromDto = productMapper.toEntity(productDto);
        assertThat(productFromDto).isNotNull();
        assertThat(productFromDto.getProductCode()).isEqualTo(productDto.getProductCode());

        List<ProductDto> dtoList = productMapper.toDtoList(List.of(product));
        assertThat(dtoList).hasSize(1);

        // 2. CustomerMapper
        Customer customer = customerRepository.findByPhone("01711000001").orElseThrow();
        CustomerDto customerDto = customerMapper.toDto(customer);
        assertThat(customerDto).isNotNull();
        assertThat(customerDto.getName()).isEqualTo("মো: রফিকুল ইসলাম");
        assertThat(customerDto.getBusinessName()).isEqualTo("মেসার্স মদিনা ট্রেডার্স");
        assertThat(customerDto.getCreditLimit()).isEqualByComparingTo("100000.00");

        Customer customerFromDto = customerMapper.toEntity(customerDto);
        assertThat(customerFromDto).isNotNull();
        assertThat(customerFromDto.getPhone()).isEqualTo("01711000001");

        // 3. InventoryLotMapper with nested Product mapping
        InventoryLot lot = inventoryLotRepository.findByBarcode("SYN-AMI-202502").orElseThrow();
        InventoryLotDto lotDto = inventoryLotMapper.toDto(lot);
        assertThat(lotDto).isNotNull();
        assertThat(lotDto.getLotNumber()).isEqualTo("LOT-2025B2");
        assertThat(lotDto.getProductId()).isEqualTo(product.getId());
        assertThat(lotDto.getProductCode()).isEqualTo("SYN-AMI-TOP");
        assertThat(lotDto.getProductNameEn()).isEqualTo("Amistar Top 325 SC");
        assertThat(lotDto.getPurchaseCost()).isEqualByComparingTo("500.00");

        InventoryLot lotFromDto = inventoryLotMapper.toEntity(lotDto);
        assertThat(lotFromDto).isNotNull();
        assertThat(lotFromDto.getLotNumber()).isEqualTo("LOT-2025B2");
    }
}
