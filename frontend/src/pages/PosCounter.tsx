import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import type {
  StockItem,
  Customer,
  SaleRequest,
  SaleResponse,
} from "../types"
import { getStock, getCustomers, createSale, createCustomer } from "../api/endpoints"
import { useCart } from "../context/CartContext"
import { useToast } from "../context/ToastContext"
import { useBarcodeScanner } from "../utils/barcode"
import { isTypingTarget } from "../utils/keyboard"
import ProductSearch from "../components/pos/ProductSearch"
import CartTicket from "../components/pos/CartTicket"
import SettlementPanel from "../components/pos/SettlementPanel"
import DualPrintModal from "../components/pos/DualPrintModal"

export interface PosCounterProps {
  isFocusMode?: boolean
  onToggleFocusMode?: () => void
}

function normalizeBangladeshPhone(value: string) {
  const digits = value.replace(/\D/g, "")
  if (digits.length === 13 && digits.startsWith("88")) return digits.slice(2)
  return digits
}

export default function PosCounter({
  isFocusMode = false,
  onToggleFocusMode,
}: PosCounterProps) {
  const { showSuccess, showError, showWarning } = useToast()
  const {
    cart,
    saleMode,
    selectedCustomerId,
    setSelectedCustomerId,
    computedDiscount,
    roundOff,
    paymentMethod,
    cashPaid,
    digitalPaid,
    digitalMedium,
    digitalTrxId,
    finalTotalAmount,
    addToCart,
    clearCart,
  } = useCart()

  // ─── Remote Data State ──────────────────────────────────────────
  const [stocks, setStocks] = useState<StockItem[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [isPrintPromptOpen, setIsPrintPromptOpen] = useState(false)
  const [completedCustomer, setCompletedCustomer] = useState<Customer | null>(null)
  const checkoutKeyRef = useRef<string | null>(null)

  // ─── Fetch Stock and Customers ──────────────────────────────────
  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true)
      const [stockData, customerData] = await Promise.all([
        getStock(true),
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
  }, [loadInitialData])

  // ─── Hardware Barcode Scanner Listener ──────────────────────────
  // Intercepts physical scanner keyboard wedges (<=35ms burst rate)
  useBarcodeScanner(
    (scannedCode) => {
      const q = scannedCode.trim().toLowerCase()
      if (!q) return

      // In-stock lots only
      const inStockStocks = stocks.filter((s) => {
        const qty = Number(s.quantity ?? (s as any).totalQuantity ?? 0)
        return qty > 0
      })

      const matchedLot = inStockStocks.find(
        (s) =>
          ((s as any).lotBarcode && (s as any).lotBarcode.toLowerCase() === q) ||
          ((s as any).barcode && (s as any).barcode.toLowerCase() === q),
      )
      const matchedStock =
        matchedLot ||
        inStockStocks
          .filter(
            (s) =>
              (s.defaultBarcode && s.defaultBarcode.toLowerCase() === q) ||
              (s.productCode && s.productCode.toLowerCase() === q),
          )
          .sort(
            (a, b) =>
              new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime(),
          )[0]

      if (matchedStock) {
        addToCart(matchedStock)
        showSuccess(
          `Barcode scan successful: ${matchedStock.nameEn || matchedStock.productNameEn}`,
          undefined,
          { closePrevious: true },
        )
      } else {
        const outOfStockMatch = stocks.find(
          (s) =>
            ((s as any).lotBarcode && (s as any).lotBarcode.toLowerCase() === q) ||
            ((s as any).barcode && (s as any).barcode.toLowerCase() === q) ||
            (s.defaultBarcode && s.defaultBarcode.toLowerCase() === q) ||
            (s.productCode && s.productCode.toLowerCase() === q),
        )
        if (outOfStockMatch) {
          showWarning(
            `Product (${outOfStockMatch.nameEn || outOfStockMatch.productNameEn}) is out of stock (0 quantity)!`,
            undefined,
            { closePrevious: true },
          )
        } else {
          showWarning(
            `Scanned barcode (${scannedCode}) was not found in the database!`,
            undefined,
            { closePrevious: true },
          )
        }
      }
      window.dispatchEvent(new CustomEvent("pos-barcode-scanned"))
    },
    { enabled: true },
  )

  // Selected customer object
  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) || null
  }, [customers, selectedCustomerId])

  // Open the print gate. No backend sale is created until thermal print is chosen.
  const handleCompleteSale = useCallback(() => {
    if (cart.length === 0) {
      showWarning("Cart is empty!")
      return
    }

    setCompletedCustomer(selectedCustomer)
    setIsPrintPromptOpen(true)
  }, [cart.length, selectedCustomer, showWarning])

  const resolveCustomerForSale = useCallback(
    async ({ phone, name }: { phone: string; name: string }): Promise<Customer> => {
      const normalizedPhone = normalizeBangladeshPhone(phone)
      const existingCustomer = customers.find(
        (customer) => normalizeBangladeshPhone(customer.phone) === normalizedPhone,
      )

      if (existingCustomer) {
        setSelectedCustomerId(existingCustomer.id)
        setCompletedCustomer(existingCustomer)
        return existingCustomer
      }

      const createdCustomer = await createCustomer({
        name: name.trim(),
        phone: normalizedPhone,
        customerType: saleMode,
        currentDue: 0,
      })

      setCustomers((currentCustomers) => [createdCustomer, ...currentCustomers])
      setSelectedCustomerId(createdCustomer.id)
      setCompletedCustomer(createdCustomer)
      return createdCustomer
    },
    [customers, saleMode, setSelectedCustomerId],
  )

  // Thermal print is the registration boundary for a POS sale.
  const registerSaleForThermalPrint = useCallback(async (customerIdOverride?: number | null): Promise<SaleResponse> => {
    const effectiveCustomerId =
      customerIdOverride !== undefined ? customerIdOverride : selectedCustomerId
    const saleRequest: SaleRequest = {
      customerId: effectiveCustomerId,
      saleMode,
      items: cart.map((item) => ({
        lotId: item.lotId,
        totalQuantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      discount: computedDiscount,
      roundOff: roundOff,
      paymentMethod,
      cashPaid:
        paymentMethod === "CASH" || paymentMethod === "DUE"
          ? Math.min(cashPaid, finalTotalAmount)
          : 0,
      cashTendered:
        paymentMethod === "CASH" || paymentMethod === "DUE"
          ? Math.max(cashPaid, Math.min(cashPaid, finalTotalAmount))
          : 0,
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
      cashierName: "Rajib",
      clientTrxId: checkoutKeyRef.current || (checkoutKeyRef.current = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `sale-${Date.now()}`),
    }

    try {
      setIsSubmitting(true)
      const res = await createSale(saleRequest)
      checkoutKeyRef.current = null
      clearCart()

      // Refresh stock counts in background (in-stock only for POS)
      getStock(true).then(setStocks).catch(console.error)
      return res
    } catch (err) {
      showError(err, "Could not complete the sale")
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }, [
    cart,
    paymentMethod,
    selectedCustomerId,
    saleMode,
    computedDiscount,
    roundOff,
    cashPaid,
    finalTotalAmount,
    digitalPaid,
    digitalMedium,
    digitalTrxId,
    clearCart,
    showError,
  ])

  const handleSaleCompleted = useCallback(
    (sale: SaleResponse, _action: "thermal" | "a4" | "skipped") => {
      showSuccess(
        `Invoice #${sale.invoiceNo} has been completed and the counter is ready for the next order.`,
        "Sale completed",
        { position: "top-center" },
      )
    },
    [showSuccess],
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPrintPromptOpen) return
      if (e.key !== "Enter" && e.key !== "F9") return
      // Enter inside a text field belongs to that field (search, cash amount…).
      if (e.key === "Enter" && isTypingTarget(e.target)) return
      if (cart.length === 0 || isSubmitting) return

      e.preventDefault()
      handleCompleteSale()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleCompleteSale, isPrintPromptOpen, cart.length, isSubmitting])

  return (
    <div
      className={`h-full min-h-0 overflow-y-auto ${
        isFocusMode ? "md:overflow-hidden" : "xl:overflow-hidden"
      }`}
    >
      <div
        className={`grid min-h-full grid-cols-1 gap-3 ${
          isFocusMode
            ? "md:h-full md:min-h-0 md:grid-cols-[minmax(0,1fr)_340px]"
            : "xl:h-full xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_370px]"
        }`}
      >
        {/* Order workspace: search command bar and the live line-item table. */}
        <section
          className={`relative flex min-h-[560px] flex-col rounded-lg border border-slate-200 bg-white shadow-xs ${
            isFocusMode ? "md:min-h-0" : "xl:min-h-0"
          }`}
        >
          <ProductSearch
            stocks={stocks}
            isLoading={isLoading}
            onAddToCart={(stock) => addToCart(stock)}
            saleMode={saleMode}
            onRefresh={loadInitialData}
            onEmptyEnter={handleCompleteSale}
            isFocusMode={isFocusMode}
            onToggleFocusMode={onToggleFocusMode}
          />
          <CartTicket />
        </section>

        {/* Checkout rail: all order processing stays in one predictable place. */}
        <aside className="flex h-full min-h-0 flex-col gap-3">
          <div className="shrink-0 flex items-center justify-between px-1 pt-1">
            <div>
              <h2 className="text-sm font-bold text-slate-950">Order processing</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Pricing and payment
              </p>
            </div>
            <span
              className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase ${
                saleMode === "WHOLESALE"
                  ? "border-purple-200 bg-purple-50 text-purple-800"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
              }`}
            >
              {saleMode}
            </span>
          </div>

          <div className="min-h-0 flex-1">
            <SettlementPanel
              isSubmitting={isSubmitting}
              onSubmitSale={handleCompleteSale}
            />
          </div>
        </aside>
      </div>

      <DualPrintModal
        isOpen={isPrintPromptOpen}
        sale={null}
        customer={completedCustomer}
        draft={{
          totalAmount: finalTotalAmount,
          cashPaid,
          digitalPaid,
        }}
        onRegisterForThermalPrint={registerSaleForThermalPrint}
        customers={customers}
        onResolveCustomerForSale={resolveCustomerForSale}
        onSaleCompleted={handleSaleCompleted}
        onClose={() => {
          setIsPrintPromptOpen(false)
          setCompletedCustomer(null)
        }}
      />
    </div>
  )
}
