import { useState, useEffect, useRef, useCallback } from "react"
import type {
  StockItem,
  Customer,
  InventoryLot,
  CartItem,
  SaleRequest,
  SaleResponse,
  SaleMode,
  PaymentMethod,
} from "../types"
import { getStock, getCustomers, createSale } from "../api/endpoints"
import LotSelectorDropdown from "../components/LotSelectorDropdown"
import SplitStockModal from "../components/SplitStockModal"
import ThermalReceipt from "../components/ThermalReceipt"
import A4InvoicePrint from "../components/A4InvoicePrint"

// BUSINESS DECISION: PosCounter connects directly to live Spring Boot endpoints (/api/inventory/stock,
// /api/customers, /api/sales). It features FEFO lot defaulting with 1-click cashier manual overrides,
// line-item price bargaining overrides, asymmetric split-stock allocation (Dokan allows negative;
// Godown strictly enforced), 1-click round-off, and dual print formats (80mm thermal and A4 invoice).

export interface PosCounterProps {
  isOwner: boolean
}

const tk = (n: number | undefined | null) =>
  `৳${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function PosCounter({ isOwner }: PosCounterProps) {
  // ─── Remote Data State ──────────────────────────────────────────
  const [stocks, setStocks] = useState<StockItem[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // ─── POS Working State ──────────────────────────────────────────
  const [saleMode, setSaleMode] = useState<SaleMode>("RETAIL")
  const [search, setSearch] = useState<string>("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)
  const [customerSearch, setCustomerSearch] = useState<string>("")
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState<boolean>(false)

  // ─── Payment & Discount State ───────────────────────────────────
  const [discountType, setDiscountType] = useState<"flat" | "percent">("flat")
  const [discountValue, setDiscountValue] = useState<string>("")
  const [roundOff, setRoundOff] = useState<number>(0)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH")
  const [cashPaidInput, setCashPaidInput] = useState<string>("")
  const [digitalPaidInput, setDigitalPaidInput] = useState<string>("")
  const [digitalMedium, setDigitalMedium] = useState<string>("BKASH")
  const [digitalTrxId, setDigitalTrxId] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  // ─── Modals State ───────────────────────────────────────────────
  const [activeSplitItem, setActiveSplitItem] = useState<CartItem | null>(null)
  const [completedSale, setCompletedSale] = useState<SaleResponse | null>(null)
  const [showThermalPrint, setShowThermalPrint] = useState<boolean>(false)
  const [showA4Print, setShowA4Print] = useState<boolean>(false)

  // ─── DOM References ─────────────────────────────────────────────
  const searchInputRef = useRef<HTMLInputElement>(null)
  const customerDropdownRef = useRef<HTMLDivElement>(null)

  // ─── Fetch Stock and Customers ──────────────────────────────────
  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true)
      setErrorMessage(null)
      const [stockData, customerData] = await Promise.all([
        getStock(),
        getCustomers(),
      ])
      setStocks(stockData)
      setCustomers(customerData)
    } catch (err: any) {
      setErrorMessage(err?.message || "ডেটা লোড করতে সমস্যা হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  // Focus search bar on load
  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  // Close customer dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        customerDropdownRef.current &&
        !customerDropdownRef.current.contains(e.target as Node)
      ) {
        setIsCustomerDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // ─── Helpers ────────────────────────────────────────────────────
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || null

  // Extract all available active lots for a given product
  const getLotsForProduct = useCallback(
    (productId: number): InventoryLot[] => {
      return stocks
        .filter((s) => s.productId === productId)
        .map((s) => ({
          id: s.lotId,
          productId: s.productId,
          productCode: s.productCode,
          productNameEn: s.productNameEn || s.nameEn,
          lotNumber: s.lotNumber,
          entryDate: s.entryDate,
          expiryDate: s.expiryDate,
          purchaseCost: s.purchaseCost,
          lotRetailPrice: s.lotRetailPrice,
          lotWholesalePrice: s.lotWholesalePrice,
          barcode: s.lotBarcode || s.barcode || "",
        }))
    },
    [stocks],
  )

  // Filter products/stocks based on user search query
  const searchResults = search.trim()
    ? stocks
        .filter((s) => {
          const q = search.trim().toLowerCase()
          const code = (s.productCode || "").toLowerCase()
          const nameEn = (s.productNameEn || s.nameEn || "").toLowerCase()
          const nameBn = (s.productNameBn || s.nameBn || "")
          const lotNum = (s.lotNumber || "").toLowerCase()
          const barcode = (s.lotBarcode || s.barcode || s.defaultBarcode || "").toLowerCase()
          return (
            code.includes(q) ||
            nameEn.includes(q) ||
            nameBn.includes(search.trim()) ||
            lotNum.includes(q) ||
            barcode.includes(q)
          )
        })
        .slice(0, 8)
    : []

  // ─── Add Product to Cart ────────────────────────────────────────
  const addToCartFromStock = useCallback(
    (stockItem: StockItem) => {
      const allProductLots = getLotsForProduct(stockItem.productId)

      // Find FEFO lot (earliest expiry date)
      const fefoLot = allProductLots.length > 0
        ? [...allProductLots].sort(
            (a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime(),
          )[0]
        : null

      const targetLot = fefoLot || stockItem
      const activeLotStock = stocks.find((s) => s.lotId === targetLot.id) || stockItem

      const defaultPrice =
        saleMode === "RETAIL"
          ? activeLotStock.lotRetailPrice
          : activeLotStock.lotWholesalePrice

      setCart((prevCart) => {
        const existingIndex = prevCart.findIndex((i) => i.lotId === targetLot.id)

        if (existingIndex > -1) {
          // Increment quantity of existing cart item
          return prevCart.map((item, idx) => {
            if (idx !== existingIndex) return item
            const newQty = Number((item.quantity + 1).toFixed(3))
            // Auto allocate Dokan if stock exists, otherwise split
            const newDokan = Number((item.dokanQuantity + 1).toFixed(3))
            return {
              ...item,
              quantity: newQty,
              totalQuantity: newQty,
              dokanQuantity: newDokan,
            }
          })
        }

        // Add new item to cart
        const newItem: CartItem = {
          id: `cart-${targetLot.id}-${Date.now()}`,
          productId: stockItem.productId,
          productCode: stockItem.productCode,
          nameEn: stockItem.productNameEn || stockItem.nameEn,
          nameBn: stockItem.productNameBn || stockItem.nameBn,
          category: stockItem.category,
          baseUnit: stockItem.baseUnit,
          cartonMultiplier: stockItem.cartonMultiplier || 1,
          defaultBarcode: stockItem.defaultBarcode,
          lotId: targetLot.id,
          lotNumber: targetLot.lotNumber,
          entryDate: targetLot.entryDate,
          expiryDate: targetLot.expiryDate,
          purchaseCost: targetLot.purchaseCost,
          lotRetailPrice: targetLot.lotRetailPrice,
          lotWholesalePrice: targetLot.lotWholesalePrice,
          barcode: targetLot.barcode,
          dokanAvailable: activeLotStock.dokanQuantity,
          godownAvailable: activeLotStock.godownQuantity,
          quantity: 1,
          totalQuantity: 1,
          dokanQuantity: 1,
          godownQuantity: 0,
          unitPrice: defaultPrice,
          originalUnitPrice: defaultPrice,
          availableLots: allProductLots,
        }

        return [newItem, ...prevCart]
      })

      setSearch("")
      searchInputRef.current?.focus()
    },
    [getLotsForProduct, saleMode, stocks],
  )

  // ─── Barcode & Enter Listener in Search ─────────────────────────
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      const query = search.trim()
      if (!query) return

      // Look for exact barcode match first
      const exactBarcodeMatch = stocks.find(
        (s) =>
          (s.lotBarcode && s.lotBarcode.toLowerCase() === query.toLowerCase()) ||
          (s.barcode && s.barcode.toLowerCase() === query.toLowerCase()) ||
          (s.defaultBarcode && s.defaultBarcode.toLowerCase() === query.toLowerCase()) ||
          (s.productCode && s.productCode.toLowerCase() === query.toLowerCase()),
      )

      if (exactBarcodeMatch) {
        addToCartFromStock(exactBarcodeMatch)
        return
      }

      // If only 1 item in search results, select it
      if (searchResults.length === 1) {
        addToCartFromStock(searchResults[0])
      }
    }
  }

  // ─── Adjust Quantity ────────────────────────────────────────────
  const adjustQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id !== itemId) return item
          const newQty = Number((item.quantity + delta).toFixed(3))
          if (newQty <= 0) return null

          // Scale dokan and godown quantity proportionally
          const dokanRatio = item.quantity > 0 ? item.dokanQuantity / item.quantity : 1
          const newDokan = Number((newQty * dokanRatio).toFixed(3))
          const newGodown = Number((newQty - newDokan).toFixed(3))

          return {
            ...item,
            quantity: newQty,
            totalQuantity: newQty,
            dokanQuantity: newDokan,
            godownQuantity: newGodown,
          }
        })
        .filter((item): item is CartItem => item !== null),
    )
  }

  const setManualQuantity = (itemId: string, val: number) => {
    if (isNaN(val) || val <= 0) return
    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item
        const dokanRatio = item.quantity > 0 ? item.dokanQuantity / item.quantity : 1
        const newDokan = Number((val * dokanRatio).toFixed(3))
        const newGodown = Number((val - newDokan).toFixed(3))
        return {
          ...item,
          quantity: val,
          totalQuantity: val,
          dokanQuantity: newDokan,
          godownQuantity: newGodown,
        }
      }),
    )
  }

  // ─── Manual Price Override (Bargaining) ─────────────────────────
  const setUnitPrice = (itemId: string, price: number) => {
    if (isNaN(price) || price < 0) return
    setCart((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, unitPrice: price } : item)),
    )
  }

  // ─── Lot Override ───────────────────────────────────────────────
  const handleSelectLot = (itemId: string, newLot: InventoryLot) => {
    const activeLotStock = stocks.find((s) => s.lotId === newLot.id)
    const defaultPrice =
      saleMode === "RETAIL" ? newLot.lotRetailPrice : newLot.lotWholesalePrice

    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item
        return {
          ...item,
          lotId: newLot.id,
          lotNumber: newLot.lotNumber,
          entryDate: newLot.entryDate,
          expiryDate: newLot.expiryDate,
          purchaseCost: newLot.purchaseCost,
          lotRetailPrice: newLot.lotRetailPrice,
          lotWholesalePrice: newLot.lotWholesalePrice,
          barcode: newLot.barcode,
          dokanAvailable: activeLotStock ? activeLotStock.dokanQuantity : 0,
          godownAvailable: activeLotStock ? activeLotStock.godownQuantity : 0,
          unitPrice: defaultPrice,
          originalUnitPrice: defaultPrice,
        }
      }),
    )
  }

  // ─── Apply Split Stock ──────────────────────────────────────────
  const handleApplySplit = (dokanQty: number, godownQty: number) => {
    if (!activeSplitItem) return
    setCart((prev) =>
      prev.map((item) =>
        item.id === activeSplitItem.id
          ? {
              ...item,
              dokanQuantity: dokanQty,
              godownQuantity: godownQty,
            }
          : item,
      ),
    )
    setActiveSplitItem(null)
  }

  // ─── Remove Item ────────────────────────────────────────────────
  const removeItem = (itemId: string) => {
    setCart((prev) => prev.filter((i) => i.id !== itemId))
  }

  // ─── Toggle Sale Mode (Retail / Wholesale) ──────────────────────
  const toggleSaleMode = (newMode: SaleMode) => {
    setSaleMode(newMode)
    setCart((prev) =>
      prev.map((item) => {
        const standardPrice =
          newMode === "RETAIL" ? item.lotRetailPrice : item.lotWholesalePrice
        return {
          ...item,
          unitPrice: standardPrice,
          originalUnitPrice: standardPrice,
        }
      }),
    )
  }

  // ─── Financial Calculations ─────────────────────────────────────
  const subtotal = cart.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  )

  const computedDiscount = (() => {
    const raw = parseFloat(discountValue) || 0
    if (raw <= 0) return 0
    if (discountType === "percent") {
      return Number(((subtotal * raw) / 100).toFixed(2))
    }
    return Math.min(raw, subtotal)
  })()

  // Net total before roundOff
  const preRoundTotal = Math.max(0, subtotal - computedDiscount)

  // 1-Click Round-Off helper: zeroes fractional small change (e.g. ৳1453 -> ৳1450)
  const roundOffDeficit = preRoundTotal > 0 ? Number((preRoundTotal % 10).toFixed(2)) : 0

  const handleApplyQuickRoundOff = () => {
    if (roundOffDeficit > 0) {
      setRoundOff(roundOffDeficit)
    } else {
      setRoundOff(0)
    }
  }

  const finalTotalAmount = Math.max(
    0,
    Number((preRoundTotal - roundOff).toFixed(2)),
  )

  // Initialize cash/digital defaults when payment method changes or total changes
  useEffect(() => {
    if (paymentMethod === "CASH") {
      setCashPaidInput(finalTotalAmount > 0 ? String(finalTotalAmount) : "")
      setDigitalPaidInput("")
    } else if (
      paymentMethod === "BKASH" ||
      paymentMethod === "NAGAD" ||
      paymentMethod === "BANK_TRANSFER"
    ) {
      setDigitalPaidInput(finalTotalAmount > 0 ? String(finalTotalAmount) : "")
      setCashPaidInput("")
      setDigitalMedium(paymentMethod)
    } else if (paymentMethod === "DUE") {
      setCashPaidInput("")
      setDigitalPaidInput("")
    }
  }, [paymentMethod, finalTotalAmount])

  const cashPaid = parseFloat(cashPaidInput) || 0
  const digitalPaid = parseFloat(digitalPaidInput) || 0
  const totalPaid = Number((cashPaid + digitalPaid).toFixed(2))
  const liveDue = Math.max(0, Number((finalTotalAmount - totalPaid).toFixed(2)))
  const changeToReturn = totalPaid > finalTotalAmount ? Number((totalPaid - finalTotalAmount).toFixed(2)) : 0

  // Total gross profit for Owner Mode
  const totalPurchaseCost = cart.reduce(
    (sum, item) => sum + item.purchaseCost * item.quantity,
    0,
  )
  const totalGrossProfit = Number((finalTotalAmount - totalPurchaseCost).toFixed(2))
  const grossProfitMargin =
    finalTotalAmount > 0
      ? Number(((totalGrossProfit / finalTotalAmount) * 100).toFixed(1))
      : 0

  // Quick cash amount suggestions
  const quickCashAmounts =
    finalTotalAmount > 0
      ? [
          ...new Set([
            finalTotalAmount,
            Math.ceil(finalTotalAmount / 50) * 50,
            Math.ceil(finalTotalAmount / 100) * 100,
            Math.ceil(finalTotalAmount / 500) * 500,
            Math.ceil(finalTotalAmount / 1000) * 1000,
          ]),
        ].filter((amt) => amt >= finalTotalAmount).slice(0, 4)
      : []

  // ─── Process Sale (Submit) ──────────────────────────────────────
  const handleProcessSale = async () => {
    if (cart.length === 0) return

    // Validation: if due is remaining, customer MUST be selected
    if (liveDue > 0 && !selectedCustomerId) {
      alert("বকেয়া বিক্রির জন্য অবশ্যই একজন গ্রাহক নির্বাচন করতে হবে!")
      return
    }

    try {
      setIsSubmitting(true)
      const salePayload: SaleRequest = {
        customerId: selectedCustomerId,
        saleMode,
        items: cart.map((item) => ({
          lotId: item.lotId,
          totalQuantity: item.quantity,
          dokanQuantity: item.dokanQuantity,
          godownQuantity: item.godownQuantity,
          unitPrice: item.unitPrice,
        })),
        discount: computedDiscount,
        roundOff,
        paymentMethod,
        cashPaid,
        digitalPaid,
        digitalMedium: digitalPaid > 0 ? digitalMedium : null,
        digitalTrxId: digitalPaid > 0 && digitalTrxId.trim() ? digitalTrxId.trim() : null,
        cashierName: isOwner ? "মালিক (Admin)" : "আল-আমিন",
      }

      const response = await createSale(salePayload)
      setCompletedSale(response)

      // Refresh live stock and customers
      await loadInitialData()

      // Reset cart and checkout fields
      setCart([])
      setDiscountValue("")
      setRoundOff(0)
      setCashPaidInput("")
      setDigitalPaidInput("")
      setDigitalTrxId("")
      setSelectedCustomerId(null)
    } catch (err: any) {
      alert(err?.message || "বিক্রয় সম্পন্ন করতে সমস্যা হয়েছে!")
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Keyboard Shortcut F2 for Sale ──────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault()
        if (cart.length > 0 && !isSubmitting) {
          handleProcessSale()
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [cart, isSubmitting, handleProcessSale])

  // Filtered customer list for customer dropdown
  const filteredCustomers = customers.filter((c) => {
    const q = customerSearch.trim().toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.businessName && c.businessName.toLowerCase().includes(q))
    )
  })

  return (
    <div className="space-y-4">
      {/* Top Banner & Mode Toggle */}
      <div className="bg-white border border-frost-border rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🛒</span>
          <div>
            <h1 className="text-lg font-bold text-frost-dark bn-text leading-tight">
              বিক্রয় কাউন্টার (POS Counter)
            </h1>
            <p className="text-xs text-frost-muted bn-text">
              সিনজেনটা বালাইনাশক ও সার দ্রুত বিক্রয় বিলিং
            </p>
          </div>
        </div>

        {/* Retail / Wholesale Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-frost-muted font-medium bn-text">
            বিক্রয় মোড:
          </span>
          <div className="inline-flex bg-frost-surface border border-frost-border rounded-xl p-1 shadow-xs">
            <button
              type="button"
              onClick={() => toggleSaleMode("RETAIL")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer bn-text ${
                saleMode === "RETAIL"
                  ? "bg-white text-emerald-800 shadow-xs ring-1 ring-emerald-600/30"
                  : "text-frost-muted hover:text-frost-dark"
              }`}
            >
              খুচরা (Retail)
            </button>
            <button
              type="button"
              onClick={() => toggleSaleMode("WHOLESALE")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer bn-text ${
                saleMode === "WHOLESALE"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "text-frost-muted hover:text-frost-dark"
              }`}
            >
              পাইকারি (Wholesale)
            </button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-xs text-red-700 flex items-center justify-between bn-text">
          <span>❌ {errorMessage}</span>
          <button
            onClick={loadInitialData}
            className="text-red-900 font-bold underline cursor-pointer"
          >
            পুনরায় চেষ্টা করুন
          </button>
        </div>
      )}

      {/* Main Counter Layout: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_390px] gap-5 items-start">
        {/* Left Column: Product Search & Cart Table */}
        <div className="space-y-4">
          {/* Search & Barcode Bar */}
          <div className="relative">
            <div className="relative">
              <span className="absolute left-4 top-3.5 text-frost-muted text-base">
                🔍
              </span>
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="পণ্যের নাম, সিনজেনটা কোড বা বারকোড স্ক্যান করুন (যেমন: SYN-AMI-202601)…"
                className="w-full bg-white border-2 border-frost-border rounded-2xl pl-11 pr-4 py-3 text-frost-dark placeholder-frost-muted focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 text-sm sm:text-base font-medium transition-all shadow-xs"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-3 text-frost-muted hover:text-frost-dark text-sm p-1 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Instant Search Results Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-30 bg-white border border-frost-border rounded-2xl shadow-2xl mt-1.5 overflow-hidden divide-y divide-frost-border/60">
                <div className="px-4 py-2 bg-frost-surface text-xs font-semibold text-frost-muted flex justify-between bn-text">
                  <span>অনুসন্ধান ফলাফল ({searchResults.length}টি পণ্য পাওয়া গেছে)</span>
                  <span>Enter চাপুন যোগ করতে</span>
                </div>
                {searchResults.map((item) => {
                  const price =
                    saleMode === "RETAIL"
                      ? item.lotRetailPrice
                      : item.lotWholesalePrice
                  const isLowDokan = item.dokanQuantity <= 0
                  return (
                    <button
                      key={`${item.productId}-${item.lotId}`}
                      type="button"
                      onClick={() => addToCartFromStock(item)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-frost-surface/80 transition-colors text-left cursor-pointer group"
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-frost-dark bn-text text-sm group-hover:text-emerald-800">
                            {item.productNameBn || item.nameBn}
                          </span>
                          <span className="font-mono text-xs px-1.5 py-0.2 rounded bg-gray-100 text-gray-700">
                            #{item.lotNumber}
                          </span>
                          <span className="text-xs text-frost-muted">
                            ({item.productNameEn || item.nameEn})
                          </span>
                        </div>
                        <div className="text-xs text-frost-muted mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                          <span>ক্যাটাগরি: {item.category}</span>
                          <span>মেয়াদ: {item.expiryDate}</span>
                          <span className="font-mono">
                            বারকোড: {item.lotBarcode || item.barcode || item.defaultBarcode}
                          </span>
                        </div>
                        <div className="text-[11px] mt-1 flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.2 rounded font-semibold bn-text ${
                              isLowDokan
                                ? "bg-amber-100 text-amber-800 border border-amber-300"
                                : "bg-emerald-50 text-emerald-800"
                            }`}
                          >
                            দোকান স্টক: {item.dokanQuantity} {item.baseUnit}
                          </span>
                          <span className="px-1.5 py-0.2 rounded font-semibold bg-purple-50 text-purple-800 bn-text">
                            গুদাম স্টক: {item.godownQuantity} {item.baseUnit}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-bold tabular-nums text-emerald-800 text-base block">
                          {tk(price)}
                        </span>
                        <span className="text-[11px] text-frost-muted block">
                          প্রতি {item.baseUnit}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Cart Table */}
          <div className="bg-white border border-frost-border rounded-2xl overflow-hidden shadow-xs">
            <div className="px-4 py-3 bg-frost-surface border-b border-frost-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-frost-dark bn-text">
                  বিক্রয় কার্ট
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                  {cart.length} আইটেম
                </span>
              </div>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-xs text-red-500 hover:text-red-700 font-semibold bn-text transition-colors cursor-pointer"
                >
                  কার্ট খালি করুন
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="py-16 text-center">
                <span className="text-4xl block mb-2">🌾</span>
                <p className="text-frost-dark font-semibold text-sm bn-text">
                  কার্টে কোনো পণ্য যোগ করা হয়নি
                </p>
                <p className="text-frost-muted text-xs mt-1 bn-text">
                  উপরের অনুসন্ধান বক্সে নাম লিখুন বা বারকোড স্ক্যান করুন
                </p>
              </div>
            ) : (
              <div className="divide-y divide-frost-border/60">
                {cart.map((item) => {
                  const lineTotal = item.unitPrice * item.quantity
                  const isPriceOverridden =
                    item.originalUnitPrice !== undefined &&
                    item.unitPrice !== item.originalUnitPrice
                  const isDokanShort = item.dokanAvailable < item.dokanQuantity

                  // Line profit calculation for owner mode
                  const lineCost = item.purchaseCost * item.quantity
                  const lineProfit = lineTotal - lineCost
                  const marginPct =
                    lineTotal > 0
                      ? ((lineProfit / lineTotal) * 100).toFixed(0)
                      : "0"

                  return (
                    <div
                      key={item.id}
                      className="p-4 hover:bg-frost-surface/40 transition-colors flex flex-col gap-3"
                    >
                      {/* Top row: Name, Lot Selector, Unit Price Bargaining */}
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-frost-dark bn-text text-sm">
                              {item.nameBn}
                            </span>
                            <span className="text-xs text-frost-muted">
                              ({item.nameEn})
                            </span>
                            <span className="text-[11px] px-1.5 py-0.2 rounded bg-gray-100 text-gray-600 font-medium">
                              {item.category}
                            </span>
                          </div>

                          {/* FEFO Lot Dropdown with Manual Override */}
                          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-semibold text-frost-muted bn-text">
                              লট:
                            </span>
                            <LotSelectorDropdown
                              lots={item.availableLots || []}
                              selectedLotId={item.lotId}
                              onSelectLot={(newLot) =>
                                handleSelectLot(item.id, newLot)
                              }
                              isOwner={isOwner}
                            />
                          </div>
                        </div>

                        {/* Line Total & Remove */}
                        <div className="text-right flex items-center gap-3">
                          <div>
                            <span className="text-base font-bold tabular-nums text-frost-dark block">
                              {tk(lineTotal)}
                            </span>
                            <span className="text-[10px] text-frost-muted">
                              {item.quantity} {item.baseUnit} × {tk(item.unitPrice)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="text-frost-muted hover:text-red-600 text-sm p-1 rounded hover:bg-frost-hover cursor-pointer"
                            title="আইটেম মুছুন"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Middle row: Quantity controls, Price Bargaining Override input, Split Badge */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-frost-border/40">
                        {/* Quantity Counter */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => adjustQuantity(item.id, -1)}
                            className="w-8 h-8 rounded-lg border border-frost-border flex items-center justify-center text-frost-dark hover:bg-frost-hover font-bold text-sm cursor-pointer shadow-xs transition-colors"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min="0.1"
                            step="any"
                            value={item.quantity}
                            onChange={(e) =>
                              setManualQuantity(
                                item.id,
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            className="w-16 text-center border border-frost-border rounded-lg py-1 font-bold tabular-nums text-frost-dark text-sm focus:border-emerald-600 focus:outline-hidden"
                          />
                          <button
                            type="button"
                            onClick={() => adjustQuantity(item.id, 1)}
                            className="w-8 h-8 rounded-lg border border-frost-border flex items-center justify-center text-frost-dark hover:bg-frost-hover font-bold text-sm cursor-pointer shadow-xs transition-colors"
                          >
                            +
                          </button>
                          <span className="text-xs text-frost-muted bn-text ml-1">
                            {item.baseUnit}
                          </span>
                        </div>

                        {/* Price Bargaining Override Input */}
                        <div className="flex items-center gap-1.5">
                          <label className="text-xs font-semibold text-frost-muted bn-text">
                            দর (৳):
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.unitPrice}
                            onChange={(e) =>
                              setUnitPrice(
                                item.id,
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            className={`w-24 border rounded-lg px-2 py-1 font-bold tabular-nums text-sm text-right focus:outline-hidden ${
                              isPriceOverridden
                                ? "border-amber-400 bg-amber-50/50 text-amber-900 focus:border-amber-600"
                                : "border-frost-border focus:border-emerald-600"
                            }`}
                            title="দর কষাকষির মাধ্যমে মূল্য পরিবর্তন করতে সরাসরি লিখুন"
                          />
                          {isPriceOverridden && (
                            <span className="text-[10px] text-amber-700 bg-amber-100 px-1 py-0.5 rounded font-semibold bn-text">
                              দর পরিবর্তন
                            </span>
                          )}
                        </div>

                        {/* Split Stock Badge & Deficit Indicator */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveSplitItem(item)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-frost-surface hover:bg-frost-hover border border-frost-border transition-colors cursor-pointer"
                            title="দোকান ও গুদামের মধ্যে স্টক বণ্টন পরিবর্তন করুন"
                          >
                            <span className="text-[11px]">🏭</span>
                            <span className="bn-text text-frost-dark">
                              দোকান: {item.dokanQuantity} | গুদাম: {item.godownQuantity}
                            </span>
                            <span className="text-[10px] text-frost-muted underline">
                              বণ্টন
                            </span>
                          </button>

                          {/* Dokan Stock Deficit Alert Badge */}
                          {isDokanShort && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 bn-text">
                              ⚠️ দোকান ঘাটতি ({item.dokanAvailable - item.dokanQuantity})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Owner Gross Profit Display */}
                      {isOwner && (
                        <div className="text-[11px] font-semibold text-emerald-900 bg-emerald-50/80 border border-emerald-200 rounded-lg px-2.5 py-1 flex items-center justify-between">
                          <span className="bn-text">
                            মালিক তথ্য — ক্রয় খরচ: {tk(lineCost)}
                          </span>
                          <span className="tabular-nums">
                            গ্রস লাভ: +{tk(lineProfit)} ({marginPct}%)
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Checkout & Payment Panel */}
        <div className="bg-white border border-frost-border rounded-2xl p-5 space-y-4 shadow-xs sticky top-[70px]">
          {/* Customer Selector Block */}
          <div ref={customerDropdownRef} className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-frost-dark bn-text">
                গ্রাহক নির্বাচন (Customer):
              </label>
              {selectedCustomer && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomerId(null)
                    setCustomerSearch("")
                  }}
                  className="text-[11px] text-red-500 hover:text-red-700 font-semibold bn-text cursor-pointer"
                >
                  সাধারণ ক্রেতা (মুছুন)
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsCustomerDropdownOpen((prev) => !prev)}
              className="w-full text-left p-2.5 border border-frost-border rounded-xl bg-frost-surface/50 hover:bg-frost-surface flex items-center justify-between transition-colors cursor-pointer"
            >
              {selectedCustomer ? (
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-frost-dark text-xs bn-text">
                      {selectedCustomer.name}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 bn-text">
                      {selectedCustomer.customerType === "WHOLESALE" ? "পাইকারি" : "খুচরা"}
                    </span>
                  </div>
                  <div className="text-[11px] text-frost-muted font-mono mt-0.5">
                    {selectedCustomer.phone} ·{" "}
                    <span className="text-red-600 font-semibold">
                      বাকি: {tk(selectedCustomer.currentDue)}
                    </span>
                  </div>
                </div>
              ) : (
                <span className="text-xs text-frost-muted bn-text">
                  সাধারণ খুচরা ক্রেতা (Walk-in Customer)
                </span>
              )}
              <span className="text-xs text-frost-muted">▼</span>
            </button>

            {/* Customer Search & Select Dropdown */}
            {isCustomerDropdownOpen && (
              <div className="absolute top-full left-0 right-0 z-40 bg-white border border-frost-border rounded-xl shadow-xl mt-1 overflow-hidden divide-y divide-frost-border/60">
                <div className="p-2 bg-frost-surface">
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="নাম বা মোবাইল নম্বর লিখুন…"
                    className="w-full border border-frost-border rounded-lg px-2.5 py-1.5 text-xs text-frost-dark focus:outline-hidden focus:border-emerald-600 bg-white"
                    autoFocus
                  />
                </div>
                <div className="max-h-52 overflow-y-auto divide-y divide-frost-border/40">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomerId(null)
                      setIsCustomerDropdownOpen(false)
                    }}
                    className="w-full text-left p-2.5 text-xs hover:bg-frost-surface text-frost-muted bn-text cursor-pointer"
                  >
                    সাধারণ খুচরা ক্রেতা (নামহীন)
                  </button>
                  {filteredCustomers.map((cust) => (
                    <button
                      key={cust.id}
                      type="button"
                      onClick={() => {
                        setSelectedCustomerId(cust.id)
                        setIsCustomerDropdownOpen(false)
                      }}
                      className="w-full text-left p-2.5 hover:bg-frost-surface transition-colors cursor-pointer flex flex-col gap-0.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-frost-dark bn-text">
                          {cust.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-100 text-gray-700 bn-text">
                          {cust.customerType === "WHOLESALE" ? "পাইকারি" : "খুচরা"}
                        </span>
                      </div>
                      <div className="text-[11px] text-frost-muted flex justify-between">
                        <span>{cust.phone}</span>
                        <span className={cust.currentDue > 0 ? "text-red-600 font-bold" : "text-emerald-700"}>
                          বাকি: {tk(cust.currentDue)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Subtotal & Totals Summary */}
          <div className="border-t border-frost-border pt-3 space-y-2 text-xs">
            <div className="flex justify-between text-frost-muted">
              <span className="bn-text">উপ-মোট (Subtotal):</span>
              <span className="tabular-nums font-bold text-frost-dark text-sm">
                {tk(subtotal)}
              </span>
            </div>

            {/* Discount Section */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <span className="bn-text text-frost-muted">বিশেষ ছাড়:</span>
                <button
                  type="button"
                  onClick={() =>
                    setDiscountType((prev) => (prev === "flat" ? "percent" : "flat"))
                  }
                  className="text-[10px] px-1 py-0.5 rounded border border-frost-border bg-frost-surface text-frost-dark font-bold cursor-pointer"
                >
                  {discountType === "flat" ? "৳" : "%"}
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder="০"
                  className="w-20 border border-frost-border rounded-lg px-2 py-1 text-right font-bold tabular-nums focus:border-emerald-600 focus:outline-hidden"
                />
                {computedDiscount > 0 && (
                  <span className="text-frost-muted tabular-nums">
                    (-{tk(computedDiscount)})
                  </span>
                )}
              </div>
            </div>

            {/* 1-Click Round-Off Section */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1.5">
                <span className="bn-text text-frost-muted">রাউন্ড-অফ:</span>
                {roundOffDeficit > 0 && roundOff === 0 && (
                  <button
                    type="button"
                    onClick={handleApplyQuickRoundOff}
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 transition-colors cursor-pointer bn-text"
                  >
                    ৳{roundOffDeficit} বাদ দিন
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={roundOff}
                  onChange={(e) => setRoundOff(parseFloat(e.target.value) || 0)}
                  className="w-16 border border-frost-border rounded-lg px-2 py-1 text-right font-bold tabular-nums focus:border-emerald-600 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Big Total Box */}
            <div className="bg-frost-surface rounded-xl p-3 border border-frost-border text-center">
              <span className="text-[11px] font-bold text-frost-muted uppercase tracking-wider bn-text block mb-0.5">
                সর্বমোট প্রদেয় বিল
              </span>
              <span className="text-3xl font-black tabular-nums text-frost-dark block">
                {tk(finalTotalAmount)}
              </span>
            </div>

            {/* Owner Mode Gross Profit Breakdown */}
            {isOwner && cart.length > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-[11px] text-emerald-900 space-y-0.5">
                <div className="flex justify-between font-semibold">
                  <span className="bn-text">মোট ক্রয় খরচ:</span>
                  <span className="tabular-nums">{tk(totalPurchaseCost)}</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-800">
                  <span className="bn-text">মোট গ্রস প্রফিট:</span>
                  <span className="tabular-nums">
                    +{tk(totalGrossProfit)} ({grossProfitMargin}%)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Payment Method Selector Tabs */}
          <div className="border-t border-frost-border pt-3">
            <label className="block text-xs font-bold text-frost-dark bn-text mb-1.5">
              পেমেন্ট মাধ্যম (Payment Method):
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: "CASH", label: "নগদ (Cash)" },
                  { id: "BKASH", label: "বিকাশ" },
                  { id: "NAGAD", label: "নগদ MFS" },
                  { id: "BANK_TRANSFER", label: "ব্যাংক" },
                  { id: "DUE", label: "বাকি (Due)" },
                  { id: "SPLIT", label: "মিশ্র (Split)" },
                ] as const
              ).map((pm) => (
                <button
                  key={pm.id}
                  type="button"
                  onClick={() => setPaymentMethod(pm.id)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer bn-text ${
                    paymentMethod === pm.id
                      ? "bg-emerald-800 text-white shadow-xs"
                      : "bg-frost-surface hover:bg-frost-hover text-frost-muted"
                  }`}
                >
                  {pm.label}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Amounts Inputs (Cash & Digital) */}
          <div className="space-y-2.5 border-t border-frost-border pt-3 text-xs">
            {paymentMethod !== "DUE" && (
              <div>
                <label className="block font-semibold text-frost-dark bn-text mb-1">
                  নগদ প্রদান (৳):
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={cashPaidInput}
                  onChange={(e) => setCashPaidInput(e.target.value)}
                  placeholder="০.০০"
                  className="w-full border-2 border-frost-border rounded-xl px-3 py-2 text-base font-bold tabular-nums text-frost-dark focus:border-emerald-600 focus:outline-hidden"
                />
              </div>
            )}

            {/* Quick Cash Buttons */}
            {paymentMethod === "CASH" && quickCashAmounts.length > 0 && (
              <div className="grid grid-cols-2 gap-1.5">
                {quickCashAmounts.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setCashPaidInput(String(amt))}
                    className="py-1 px-2 border border-frost-border rounded-lg text-xs font-semibold tabular-nums text-frost-dark hover:bg-frost-hover text-center cursor-pointer"
                  >
                    {tk(amt)}
                  </button>
                ))}
              </div>
            )}

            {/* Digital Payment Fields (if SPLIT or Digital selected) */}
            {(paymentMethod === "SPLIT" ||
              paymentMethod === "BKASH" ||
              paymentMethod === "NAGAD" ||
              paymentMethod === "BANK_TRANSFER") && (
              <div className="space-y-2 bg-frost-surface/60 p-2.5 rounded-xl border border-frost-border">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-frost-dark bn-text mb-1">
                      ডিজিটাল পরিশোধ (৳):
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={digitalPaidInput}
                      onChange={(e) => setDigitalPaidInput(e.target.value)}
                      placeholder="০.০০"
                      className="w-full border border-frost-border rounded-lg px-2.5 py-1.5 font-bold tabular-nums text-frost-dark focus:border-emerald-600 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-frost-dark bn-text mb-1">
                      মাধ্যম:
                    </label>
                    <select
                      value={digitalMedium}
                      onChange={(e) => setDigitalMedium(e.target.value)}
                      className="w-full border border-frost-border rounded-lg px-2 py-1.5 font-semibold text-frost-dark focus:border-emerald-600 focus:outline-hidden bg-white text-xs"
                    >
                      <option value="BKASH">bKash (বিকাশ)</option>
                      <option value="NAGAD">Nagad (নগদ)</option>
                      <option value="ROCKET">Rocket (রকেট)</option>
                      <option value="BANK_TRANSFER">Bank Transfer (ব্যাংক)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-frost-dark bn-text mb-1">
                    লেনদেন নম্বর (TrxID - ঐচ্ছিক):
                  </label>
                  <input
                    type="text"
                    value={digitalTrxId}
                    onChange={(e) => setDigitalTrxId(e.target.value)}
                    placeholder="e.g. 9J87K2L1"
                    className="w-full border border-frost-border rounded-lg px-2.5 py-1.5 font-mono text-xs uppercase focus:border-emerald-600 focus:outline-hidden bg-white"
                  />
                </div>
              </div>
            )}

            {/* Change Return or Live Due calculation */}
            {changeToReturn > 0 && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-center">
                <span className="text-[11px] font-bold text-emerald-800 bn-text block">
                  গ্রাহককে ফেরত দিন:
                </span>
                <span className="text-2xl font-black tabular-nums text-emerald-900 block">
                  {tk(changeToReturn)}
                </span>
              </div>
            )}

            {liveDue > 0 && (
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-300 text-center">
                <span className="text-[11px] font-bold text-red-800 bn-text block">
                  বাকি পরিমাণ (Current Due):
                </span>
                <span className="text-2xl font-black tabular-nums text-red-700 block">
                  {tk(liveDue)}
                </span>
                {!selectedCustomerId && (
                  <span className="text-[10px] text-red-600 font-bold bn-text block mt-1">
                    ⚠️ বাকি বিক্রির জন্য উপরে গ্রাহক নির্বাচন করুন
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Submit Checkout Button */}
          <button
            type="button"
            onClick={handleProcessSale}
            disabled={
              cart.length === 0 ||
              isSubmitting ||
              (liveDue > 0 && !selectedCustomerId)
            }
            className="w-full py-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-base bn-text transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="animate-spin">⏳</span>
                <span>বিক্রয় সম্পন্ন হচ্ছে...</span>
              </>
            ) : (
              <>
                <span>✓</span>
                <span>বিক্রয় সম্পন্ন করুন (F2)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Split Stock Modal */}
      {activeSplitItem && (
        <SplitStockModal
          item={activeSplitItem}
          isOpen={Boolean(activeSplitItem)}
          onClose={() => setActiveSplitItem(null)}
          onApplySplit={handleApplySplit}
        />
      )}

      {/* Completed Sale Confirmation Modal */}
      {completedSale && !showThermalPrint && !showA4Print && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-frost-border max-w-md w-full p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-3xl mx-auto">
              ✓
            </div>

            <div>
              <h3 className="text-xl font-black text-frost-dark bn-text">
                বিক্রয় সফলভাবে সম্পন্ন হয়েছে!
              </h3>
              <p className="text-xs text-frost-muted mt-1 font-mono">
                ইনভয়েস নং: <span className="font-bold text-frost-dark">{completedSale.invoiceNo}</span>
              </p>
            </div>

            <div className="p-3 bg-frost-surface rounded-xl border border-frost-border text-xs space-y-1">
              <div className="flex justify-between">
                <span className="bn-text text-frost-muted">মোট বিল:</span>
                <span className="font-bold tabular-nums">{tk(completedSale.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="bn-text text-frost-muted">পরিশোধ:</span>
                <span className="font-bold tabular-nums text-emerald-700">
                  {tk((completedSale.cashPaid || 0) + (completedSale.digitalPaid || 0))}
                </span>
              </div>
              {completedSale.dueAmount > 0 && (
                <div className="flex justify-between text-red-600 font-bold border-t border-frost-border/60 pt-1">
                  <span className="bn-text">বাকি:</span>
                  <span className="tabular-nums">{tk(completedSale.dueAmount)}</span>
                </div>
              )}
            </div>

            {/* Print Selection Actions */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => setShowThermalPrint(true)}
                className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm bn-text transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <span>🖨️</span>
                <span>প্রিন্ট ক্যাশ মেমো (80mm)</span>
              </button>

              <button
                type="button"
                onClick={() => setShowA4Print(true)}
                className="w-full py-2.5 rounded-xl border-2 border-emerald-700 text-emerald-800 hover:bg-emerald-50 font-bold text-sm bn-text transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>📄</span>
                <span>প্রিন্ট পাইকারি চালান (A4)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCompletedSale(null)
                  setShowThermalPrint(false)
                  setShowA4Print(false)
                  searchInputRef.current?.focus()
                }}
                className="w-full py-2 rounded-xl text-xs font-semibold text-frost-muted hover:text-frost-dark bn-text cursor-pointer transition-colors"
              >
                নতুন বিক্রয় শুরু করুন (New Sale)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 80mm Thermal Receipt Print Preview */}
      {showThermalPrint && completedSale && (
        <ThermalReceipt
          sale={completedSale}
          onClose={() => {
            setShowThermalPrint(false)
            setCompletedSale(null)
            searchInputRef.current?.focus()
          }}
        />
      )}

      {/* A4 Wholesale Challan & Invoice Print Preview */}
      {showA4Print && completedSale && (
        <A4InvoicePrint
          sale={completedSale}
          customer={
            completedSale.customerId
              ? customers.find((c) => c.id === completedSale.customerId) || null
              : null
          }
          onClose={() => {
            setShowA4Print(false)
            setCompletedSale(null)
            searchInputRef.current?.focus()
          }}
        />
      )}
    </div>
  )
}
