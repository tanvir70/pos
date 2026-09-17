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
      showError(err, "তথ্য লোড ব্যর্থ")
    } finally {
      setIsLoading(false)
    }
  }, [showError])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

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
        showSuccess(`বারকোড স্ক্যান সফল: ${matchedStock.nameBn || matchedStock.productNameBn}`)
      } else {
        showWarning(`স্ক্যান করা বারকোড (${scannedCode}) ডাটাবেসে পাওয়া যায়নি!`)
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
      showWarning("কার্টে কোনো পণ্য নেই!")
      return
    }

    if (paymentMethod === "DUE" && !selectedCustomerId) {
      showWarning("বাকি বিক্রয়ের জন্য নির্দিষ্ট গ্রাহক নির্বাচন করতে হবে!")
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
      cashierName: isOwner ? "মালিক (Owner)" : "কাউন্টার ক্যাশিয়ার",
    }

    try {
      setIsSubmitting(true)
      const res = await createSale(saleRequest)
      setCompletedSale(res)
      clearCart()
      showSuccess(`বিক্রি সফলভাবে সম্পন্ন হয়েছে! ইনভয়েস #${res.invoiceNumber}`)

      // Refresh stock counts in background
      getStock().then(setStocks).catch(console.error)
    } catch (err) {
      showError(err, "বিক্রি সম্পন্ন করা যায়নি")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-5rem)] min-h-[620px]">
      {/* Top Counter Status Bar */}
      <div className="bg-white px-4 py-2 rounded-xl border border-frost-border shadow-xs flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-frost-dark bn-text">
              কাউন্টার টার্মিনাল সক্রিয়
            </span>
          </div>

          <div className="h-4 w-px bg-frost-border hidden sm:block" />

          {/* Sale Mode Toggle (Retail vs Wholesale) */}
          <div className="flex items-center bg-frost-surface p-0.5 rounded-lg border border-frost-border">
            <button
              type="button"
              onClick={() => toggleSaleMode("RETAIL")}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer bn-text ${
                saleMode === "RETAIL"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "text-frost-muted hover:text-frost-dark"
              }`}
            >
              খুচরা বিক্রয় (Retail)
            </button>
            <button
              type="button"
              onClick={() => toggleSaleMode("WHOLESALE")}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer bn-text ${
                saleMode === "WHOLESALE"
                  ? "bg-purple-700 text-white shadow-xs"
                  : "text-frost-muted hover:text-frost-dark"
              }`}
            >
              পাইকারি বিক্রয় (Wholesale)
            </button>
          </div>
        </div>

        {/* Counter Info & Refresh */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-xs text-frost-muted bn-text">
            <span>স্টক আইটেম:</span>
            <span className="font-bold font-mono text-frost-dark">
              {stocks.length}
            </span>
          </div>

          <button
            type="button"
            onClick={loadInitialData}
            disabled={isLoading}
            className="p-1.5 text-frost-muted hover:text-frost-dark rounded-lg hover:bg-frost-surface cursor-pointer text-xs"
            title="স্টক ও ডেটা রিফ্রেশ করুন"
          >
            🔄
          </button>
        </div>
      </div>

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
          <div className="flex-1 min-h-[220px]">
            <CartTicket isOwner={isOwner} stocks={stocks} />
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
