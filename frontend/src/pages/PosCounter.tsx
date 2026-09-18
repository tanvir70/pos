import { useState, useEffect, useCallback, useMemo } from "react"
import type {
  StockItem,
  Customer,
  InventoryLot,
  SaleRequest,
  SaleResponse,
  SaleMode,
} from "../types"
import { getStock, getCustomers, createSale } from "../api/endpoints"
import { useCart } from "../context/CartContext"
import { useToast } from "../context/ToastContext"
import { useBarcodeScanner } from "../utils/barcode"
import ProductCatalogGrid from "../components/pos/ProductCatalogGrid"
import CustomerSelect from "../components/pos/CustomerSelect"
import CartTicket from "../components/pos/CartTicket"
import SettlementPanel from "../components/pos/SettlementPanel"
import DualPrintModal from "../components/pos/DualPrintModal"

export interface PosCounterProps {
  isOwner: boolean
}

export default function PosCounter({ isOwner }: PosCounterProps) {
  const { showSuccess, showError, showWarning } = useToast()
  const {
    cart,
    saleMode,
    toggleSaleMode,
    selectedCustomerId,
    setSelectedCustomerId,
    computedDiscount,
    roundOff,
    paymentMethod,
    cashPaid,
    digitalPaid,
    digitalMedium,
    digitalTrxId,
    addToCart,
    clearCart,
  } = useCart()

  // ─── Remote Data State ──────────────────────────────────────────
  const [stocks, setStocks] = useState<StockItem[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [completedSale, setCompletedSale] = useState<SaleResponse | null>(null)

  // ─── Fetch Stock and Customers ──────────────────────────────────
  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true)
      const [stockData, customerData] = await Promise.all([
        getStock(),
        getCustomers(),
      ])
      setStocks(stockData)
      setCustomers(customerData)
    } catch (err) {
      showError(err, "Failed to load data")
    } finally {
      setIsLoading(false)
    }
  }, [showError])

  useEffect(() => {
    loadInitialData()
    // Re-fetch when Owner Mode toggles: purchase cost fields are stripped
    // server-side for non-owner requests, so cached data must be refreshed.
  }, [loadInitialData, isOwner])

  // Extract all lots for a product
  const getLotsForProduct = useCallback(
    (productId: number): InventoryLot[] => {
      return stocks
        .filter((s) => s.productId === productId)
        .map((s) => ({
          id: (s as any).lotId,
          productId: s.productId,
          productCode: s.productCode,
          productNameEn: s.productNameEn || s.nameEn,
          lotNumber: (s as any).lotNumber || "DEF",
          entryDate: (s as any).entryDate || new Date().toISOString(),
          expiryDate: (s as any).expiryDate || "2099-12-31",
          purchaseCost: (s as any).purchaseCost || 0,
          lotRetailPrice: (s as any).lotRetailPrice || s.standardRetailPrice || 0,
          lotWholesalePrice: (s as any).lotWholesalePrice || s.standardWholesalePrice || 0,
          barcode: (s as any).lotBarcode || (s as any).barcode || "",
        }))
    },
    [stocks],
  )

  // ─── Hardware Barcode Scanner Listener ──────────────────────────
  // Intercepts physical scanner keyboard wedges (<=35ms burst rate)
  useBarcodeScanner({
    onScan: (scannedCode) => {
      const q = scannedCode.trim().toLowerCase()
      if (!q) return

      const matchedStock = stocks.find(
        (s) =>
          ((s as any).lotBarcode && (s as any).lotBarcode.toLowerCase() === q) ||
          ((s as any).barcode && (s as any).barcode.toLowerCase() === q) ||
          (s.defaultBarcode && s.defaultBarcode.toLowerCase() === q) ||
          (s.productCode && s.productCode.toLowerCase() === q),
      )

      if (matchedStock) {
        addToCart(matchedStock, getLotsForProduct(matchedStock.productId))
        showSuccess(
          `Barcode scan successful: ${matchedStock.nameEn || matchedStock.productNameEn}`,
        )
      } else {
        showWarning(`Scanned barcode (${scannedCode}) was not found in the database!`)
      }
    },
    enabled: true,
  })

  // Selected customer object
  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) || null
  }, [customers, selectedCustomerId])

  // ─── Complete Sale Execution ────────────────────────────────────
  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      showWarning("Cart is empty!")
      return
    }

    if (paymentMethod === "DUE" && !selectedCustomerId) {
      showWarning("A specific customer must be selected for a due sale!")
      return
    }

    const saleRequest: SaleRequest = {
      customerId: selectedCustomerId,
      saleMode,
      items: cart.map((item) => ({
        lotId: item.lotId,
        totalQuantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      discount: computedDiscount,
      roundOff: roundOff,
      paymentMethod,
      cashPaid: paymentMethod === "CASH" ? cashPaid : 0,
      digitalPaid:
        paymentMethod === "BKASH" ||
        paymentMethod === "NAGAD" ||
        paymentMethod === "BANK_TRANSFER"
          ? digitalPaid
          : 0,
      digitalMedium:
        paymentMethod === "BKASH" ||
        paymentMethod === "NAGAD" ||
        paymentMethod === "BANK_TRANSFER"
          ? digitalMedium
          : null,
      digitalTrxId: digitalTrxId ? digitalTrxId.trim() : null,
      cashierName: isOwner ? "Owner" : "Counter Cashier",
    }

    try {
      setIsSubmitting(true)
      const res = await createSale(saleRequest)
      setCompletedSale(res)
      clearCart()
      showSuccess(`Sale completed successfully! Invoice #${res.invoiceNo}`)

      // Refresh stock counts in background
      getStock().then(setStocks).catch(console.error)
    } catch (err) {
      showError(err, "Could not complete the sale")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 h-full min-h-[520px]">
      {/* Main Cockpit Split: Left 60% Catalog, Right 40% Cart & Settlement */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 overflow-hidden">
        {/* Left 60% Panel: Catalog & Search */}
        <div className="lg:col-span-7 xl:col-span-7 h-full flex flex-col min-h-0">
          <ProductCatalogGrid
            stocks={stocks}
            isLoading={isLoading}
            onAddToCart={(stock) =>
              addToCart(stock, getLotsForProduct(stock.productId))
            }
            saleMode={saleMode}
            onToggleSaleMode={toggleSaleMode}
            onRefresh={loadInitialData}
            isOwner={isOwner}
          />
        </div>

        {/* Right 40% Panel: Customer + Active Ticket + Settlement */}
        <div className="lg:col-span-5 xl:col-span-5 h-full flex flex-col gap-2.5 min-h-0">
          {/* Customer Selector */}
          <div className="shrink-0">
            <CustomerSelect
              customers={customers}
              selectedCustomerId={selectedCustomerId}
              onSelectCustomer={setSelectedCustomerId}
            />
          </div>

          {/* Active Cart Ticket */}
          <div className="flex-1 min-h-[220px] transition-[height] duration-200 ease-out">
            <CartTicket isOwner={isOwner} />
          </div>

          {/* Settlement Panel */}
          <div className="shrink-0">
            <SettlementPanel
              isOwner={isOwner}
              isSubmitting={isSubmitting}
              onSubmitSale={handleCompleteSale}
              customerDue={selectedCustomer?.currentDue || 0}
            />
          </div>
        </div>
      </div>

      {/* Dual Print Modal on Sale Completion */}
      <DualPrintModal
        isOpen={!!completedSale}
        sale={completedSale}
        customer={selectedCustomer}
        onClose={() => setCompletedSale(null)}
      />
    </div>
  )
}
