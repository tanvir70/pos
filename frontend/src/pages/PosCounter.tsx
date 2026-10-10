import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { ScanLine } from "lucide-react"
import type {
  StockItem,
  Customer,
  SaleRequest,
  SaleResponse,
} from "../types"
import { getStock, getCustomers, createSale, createCustomer, updateCustomer } from "../api/endpoints"
import { useCart } from "../context/CartContext"
import { useToast } from "../context/ToastContext"
import { useBarcodeScanner } from "../utils/barcode"
import { isTypingTarget } from "../utils/keyboard"
import ProductSearch from "../components/pos/ProductSearch"
import CartTicket from "../components/pos/CartTicket"
import SettlementPanel from "../components/pos/SettlementPanel"
import DualPrintModal from "../components/pos/DualPrintModal"
import Badge from "../components/ui/Badge"

export interface PosCounterProps {
  isFocusMode?: boolean
  onToggleFocusMode?: () => void
}

function normalizeBangladeshPhone(value: string) {
  const digits = value.replace(/\D/g, "")
  if (digits.length === 13 && digits.startsWith("88")) return digits.slice(2)
  return digits
}

function isLotExpired(lot: StockItem): boolean {
  if (!lot.expiryDate) return false
  const exp = new Date(lot.expiryDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return exp < today
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
    cashPaidInput,
    digitalPaid,
    digitalPaidInput,
    digitalMedium,
    digitalTrxId,
    liveDue,
    finalTotalAmount,
    addToCart,
    clearCart,
    parkCurrentCart,
    parkedCarts,
  } = useCart()

  // ─── Remote Data State ──────────────────────────────────────────
  const [stocks, setStocks] = useState<StockItem[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [isPrintPromptOpen, setIsPrintPromptOpen] = useState(false)
  const [completedCustomer, setCompletedCustomer] = useState<Customer | null>(null)
  const [isScanActive, setIsScanActive] = useState<boolean>(false)
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null)
  const scanTimerRef = useRef<number | null>(null)
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

  useEffect(() => {
    return () => {
      if (scanTimerRef.current) {
        window.clearTimeout(scanTimerRef.current)
      }
    }
  }, [])

  // ─── Hardware Barcode Scanner Listener ──────────────────────────
  // Intercepts physical scanner keyboard wedges (<=35ms burst rate)
  useBarcodeScanner(
    (scannedCode) => {
      const q = scannedCode.trim().toLowerCase()
      if (!q) return

      // Visual scan feedback trigger
      setIsScanActive(true)
      setLastScannedCode(scannedCode.trim())
      if (scanTimerRef.current) {
        window.clearTimeout(scanTimerRef.current)
      }
      scanTimerRef.current = window.setTimeout(() => {
        setIsScanActive(false)
      }, 1800)

      // Find candidate match across all stocks (in-stock or out-of-stock)
      const matchedLot = stocks.find(
        (s) =>
          (s.lotBarcode && s.lotBarcode.toLowerCase() === q) ||
          (s.barcode && s.barcode.toLowerCase() === q),
      )
      const matchedStock =
        matchedLot ||
        stocks
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
        const qty = Number(matchedStock.quantity ?? matchedStock.totalQuantity ?? 0)
        if (qty <= 0) {
          showWarning(
            `Product (${matchedStock.nameEn || matchedStock.productNameEn}) is out of stock (0 quantity)!`,
            undefined,
            { closePrevious: true },
          )
        } else if (isLotExpired(matchedStock)) {
          showWarning(
            `Lot #${matchedStock.lotNumber} (${matchedStock.nameEn || matchedStock.productNameEn}) is expired (${matchedStock.expiryDate}) and quarantined under Pesticide Ordinance 1971.`,
            "Agrochemical Expired",
            { closePrevious: true },
          )
        } else {
          addToCart(matchedStock)
          showSuccess(
            `Barcode scan successful: ${matchedStock.nameEn || matchedStock.productNameEn}`,
            undefined,
            { closePrevious: true },
          )
        }
      } else {
        showWarning(
          `Scanned barcode (${scannedCode}) was not found in the database!`,
          undefined,
          { closePrevious: true },
        )
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

    if (
      paymentMethod === "CASH" &&
      (cashPaidInput.trim() === "" || isNaN(parseFloat(cashPaidInput)) || parseFloat(cashPaidInput) <= 0)
    ) {
      showWarning("Please enter cash received amount (or click Exact) before completing the sale.")
      return
    }

    if (
      (paymentMethod === "BKASH" || paymentMethod === "NAGAD" || paymentMethod === "BANK_TRANSFER") &&
      (digitalPaidInput.trim() === "" || isNaN(parseFloat(digitalPaidInput)) || parseFloat(digitalPaidInput) <= 0)
    ) {
      showWarning(`Please enter ${paymentMethod} received amount before completing the sale.`)
      return
    }

    if ((paymentMethod === "DUE" || liveDue > 0) && !selectedCustomer) {
      showWarning("A registered customer must be selected to record a credit/due sale.")
      return
    }

    setCompletedCustomer(selectedCustomer)
    setIsPrintPromptOpen(true)
  }, [
    cart.length,
    paymentMethod,
    cashPaidInput,
    digitalPaidInput,
    liveDue,
    selectedCustomer,
    showWarning,
  ])

  const resolveCustomerForSale = useCallback(
    async ({
      phone,
      name,
      businessName,
      address,
    }: {
      phone: string
      name: string
      businessName?: string
      address?: string
    }): Promise<Customer> => {
      const normalizedPhone = normalizeBangladeshPhone(phone)
      const existingCustomer = customers.find(
        (customer) => normalizeBangladeshPhone(customer.phone) === normalizedPhone,
      )

      if (existingCustomer) {
        const needsAddress = address?.trim() && !existingCustomer.villageAddress && !existingCustomer.address
        const needsBusiness = businessName?.trim() && !existingCustomer.businessName
        if (needsAddress || needsBusiness) {
          try {
            const updated = await updateCustomer(existingCustomer.id, {
              name: existingCustomer.name,
              phone: existingCustomer.phone,
              customerType: existingCustomer.customerType,
              villageAddress: address?.trim() || existingCustomer.villageAddress || existingCustomer.address || undefined,
              businessName: businessName?.trim() || existingCustomer.businessName || undefined,
            })
            setCustomers((current) =>
              current.map((c) => (c.id === updated.id ? updated : c)),
            )
            setSelectedCustomerId(updated.id)
            setCompletedCustomer(updated)
            return updated
          } catch (e) {
            console.error("Failed to update customer details:", e)
          }
        }
        setSelectedCustomerId(existingCustomer.id)
        setCompletedCustomer(existingCustomer)
        return existingCustomer
      }

      const createdCustomer = await createCustomer({
        name: name.trim(),
        phone: normalizedPhone,
        businessName: businessName?.trim() || undefined,
        customerType: saleMode,
        villageAddress: address?.trim() || undefined,
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

      // Refresh stock counts in background (in-stock only for POS, forced fresh)
      getStock(true, true).then(setStocks).catch(console.error)
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

      // F4: Hold/Park Current Order
      if (e.key === "F4") {
        if (cart.length > 0) {
          e.preventDefault()
          const activeCustomer = customers.find((c) => c.id === selectedCustomerId)
          const label = activeCustomer ? activeCustomer.name : "Walk-in"
          const ok = parkCurrentCart(label)
          if (ok) {
            showSuccess(
              `Order held for ${label}. Ready for the next customer.`,
              "Order Held",
            )
          } else {
            showWarning("Maximum 3 held orders allowed. Resume or clear an existing one first.")
          }
        }
        return
      }

      if (e.key !== "Enter" && e.key !== "F9") return
      // Enter inside a text field belongs to that field (search, cash amount…).
      if (e.key === "Enter" && isTypingTarget(e.target)) return
      if (cart.length === 0 || isSubmitting) return
      if (
        paymentMethod === "CASH" &&
        (cashPaidInput.trim() === "" || isNaN(parseFloat(cashPaidInput)) || parseFloat(cashPaidInput) <= 0)
      ) {
        return
      }

      e.preventDefault()
      handleCompleteSale()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [
    handleCompleteSale,
    isPrintPromptOpen,
    cart.length,
    isSubmitting,
    paymentMethod,
    cashPaidInput,
    customers,
    selectedCustomerId,
    parkCurrentCart,
    showSuccess,
    showWarning,
  ])

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
          className={`relative flex min-h-[560px] flex-col rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs ${
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
          <CartTicket customers={customers} />

          {/* Ambient keyboard shortcut indicator bar */}
          <div className="shrink-0 flex items-center justify-between px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 text-[11px] text-slate-500 dark:text-slate-400 rounded-b-lg">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700 dark:text-slate-200 shadow-2xs">F2</kbd>
                <span>Search</span>
              </span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700 dark:text-slate-200 shadow-2xs">F4</kbd>
                <span>Hold Order</span>
              </span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700 dark:text-slate-200 shadow-2xs">F8</kbd>
                <span>Full Counter</span>
              </span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700 dark:text-slate-200 shadow-2xs">Enter / F9</kbd>
                <span>Settle &amp; Print</span>
              </span>
            </div>
            <div
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono transition-all duration-200 select-none ${
                isScanActive
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs font-semibold scale-102"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/90 dark:border-slate-700 shadow-2xs"
              }`}
              title="Hardware barcode scanner is actively listening on this terminal"
            >
              <span className="relative flex h-2 w-2">
                <span
                  className={`absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 ${
                    isScanActive ? "animate-ping" : "animate-pulse"
                  }`}
                />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <ScanLine
                className={`w-3 h-3 transition-colors ${
                  isScanActive ? "text-emerald-700 animate-pulse" : "text-slate-400"
                }`}
              />
              <span>
                {isScanActive ? `Scanned: ${lastScannedCode}` : "Auto scanner ready"}
              </span>
            </div>
          </div>
        </section>

        {/* Checkout rail: all order processing stays in one predictable place. */}
        <aside className="flex h-full min-h-0 flex-col gap-3">
          <div className="shrink-0 flex items-center justify-between px-1 pt-1">
            <div>
              <h2 className="text-sm font-bold text-slate-950 dark:text-slate-100">Order processing</h2>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                Pricing and payment
              </p>
            </div>
            <Badge
              variant={saleMode === "WHOLESALE" ? "purple" : "emerald"}
              className="px-2 py-0.5 text-[10px] font-bold uppercase"
            >
              {saleMode}
            </Badge>
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
