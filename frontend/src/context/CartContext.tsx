import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
  useRef,
} from "react"
import type {
  CartItem,
  SaleMode,
  PaymentMethod,
  InventoryLot,
  StockItem,
} from "../types"
import {
  calcLineTotal,
  calcDiscount,
  calcGrossProfit,
  calcChangeReturn,
  roundAccounting,
} from "../utils/currency"
import { formatLotNumber } from "../utils/lotNumber"

const STORAGE_KEY = "pos_active_cart_v1"

export interface CartContextType {
  cart: CartItem[]
  saleMode: SaleMode
  setSaleMode: (mode: SaleMode) => void
  toggleSaleMode: (mode: SaleMode) => void
  selectedCustomerId: number | null
  setSelectedCustomerId: (id: number | null) => void

  // Discount & Round-Off
  discountType: "flat" | "percent"
  setDiscountType: (type: "flat" | "percent") => void
  discountValue: string
  setDiscountValue: (val: string) => void
  roundOff: number
  setRoundOff: (val: number) => void
  roundOffDeficit: number
  applyQuickRoundOff: () => void

  // Payment
  paymentMethod: PaymentMethod
  setPaymentMethod: (method: PaymentMethod) => void
  cashPaidInput: string
  setCashPaidInput: (val: string) => void
  dueAmountInput: string
  setDueAmountInput: (val: string) => void
  digitalPaidInput: string
  setDigitalPaidInput: (val: string) => void
  digitalMedium: string
  setDigitalMedium: (medium: string) => void
  digitalTrxId: string
  setDigitalTrxId: (trx: string) => void

  // Cart Operations
  addToCart: (
    item: StockItem | (InventoryLot & Partial<StockItem>),
    allLots?: InventoryLot[],
  ) => void
  adjustQuantity: (itemId: string, delta: number) => void
  setQuantity: (itemId: string, quantity: number) => void
  setUnitPrice: (itemId: string, unitPrice: number) => void
  selectLot: (itemId: string, newLot: InventoryLot, availableStock?: number) => void
  removeItem: (itemId: string) => void
  clearCart: () => void

  // Financial Totals
  subtotal: number
  computedDiscount: number
  preRoundTotal: number
  finalTotalAmount: number
  dueAmount: number
  cashPaid: number
  digitalPaid: number
  totalPaid: number
  liveDue: number
  changeToReturn: number
  totalPurchaseCost: number
  totalGrossProfit: number
  grossProfitMargin: number
  totalItemsCount: number
  totalUnitsCount: number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

function availableStockLimit(item: Pick<CartItem, "availableStock">) {
  const stock = Number(item.availableStock)
  return Number.isFinite(stock) ? Math.max(0, stock) : 0
}

function clampToAvailable(quantity: number, item: Pick<CartItem, "availableStock">) {
  const stock = availableStockLimit(item)
  if (stock <= 0) return 0
  return roundAccounting(Math.min(quantity, stock))
}

interface SavedCartState {
  cart: CartItem[]
  saleMode: SaleMode
  selectedCustomerId: number | null
  discountType: "flat" | "percent"
  discountValue: string
  roundOff: number
  paymentMethod: PaymentMethod
  cashPaidInput: string
  dueAmountInput: string
  digitalPaidInput: string
  digitalMedium: string
  digitalTrxId: string
}

function loadInitialState(): SavedCartState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        cart: Array.isArray(parsed.cart) ? parsed.cart : [],
        saleMode: parsed.saleMode || "RETAIL",
        selectedCustomerId: parsed.selectedCustomerId ?? null,
        discountType: parsed.discountType || "flat",
        discountValue: parsed.discountValue || "",
        roundOff: typeof parsed.roundOff === "number" ? parsed.roundOff : 0,
        paymentMethod: parsed.paymentMethod || "CASH",
        cashPaidInput: parsed.cashPaidInput || "",
        dueAmountInput: parsed.dueAmountInput || "",
        digitalPaidInput: parsed.digitalPaidInput || "",
        digitalMedium: parsed.digitalMedium || "BKASH",
        digitalTrxId: parsed.digitalTrxId || "",
      }
    }
  } catch {
    // Ignore parse errors, fallback to empty
  }
  return {
    cart: [],
    saleMode: "RETAIL",
    selectedCustomerId: null,
    discountType: "flat",
    discountValue: "",
    roundOff: 0,
    paymentMethod: "CASH",
    cashPaidInput: "",
    dueAmountInput: "",
    digitalPaidInput: "",
    digitalMedium: "BKASH",
    digitalTrxId: "",
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [initial] = useState<SavedCartState>(loadInitialState)

  const [cart, setCart] = useState<CartItem[]>(initial.cart)
  const [saleMode, setSaleMode] = useState<SaleMode>(initial.saleMode)
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(
    initial.selectedCustomerId,
  )
  const [discountType, setDiscountType] = useState<"flat" | "percent">(
    initial.discountType,
  )
  const [discountValue, setDiscountValue] = useState<string>(initial.discountValue)
  const [roundOff, setRoundOff] = useState<number>(initial.roundOff)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    initial.paymentMethod,
  )
  const [cashPaidInput, setCashPaidInput] = useState<string>(initial.cashPaidInput)
  const [dueAmountInput, setDueAmountInput] = useState<string>(initial.dueAmountInput || "")
  const [digitalPaidInput, setDigitalPaidInput] = useState<string>(
    initial.digitalPaidInput,
  )
  const [digitalMedium, setDigitalMedium] = useState<string>(initial.digitalMedium)
  const [digitalTrxId, setDigitalTrxId] = useState<string>(initial.digitalTrxId)

  // ─── Continuous Session Auto-Save ──────────────────────────────────
  useEffect(() => {
    try {
      const stateToSave: SavedCartState = {
        cart,
        saleMode,
        selectedCustomerId,
        discountType,
        discountValue,
        roundOff,
        paymentMethod,
        cashPaidInput,
        dueAmountInput,
        digitalPaidInput,
        digitalMedium,
        digitalTrxId,
      }
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave))
    } catch {
      // Ignore quota exceeded or storage failure
    }
  }, [
    cart,
    saleMode,
    selectedCustomerId,
    discountType,
    discountValue,
    roundOff,
    paymentMethod,
    cashPaidInput,
    dueAmountInput,
    digitalPaidInput,
    digitalMedium,
    digitalTrxId,
  ])

  // ─── Financial Calculations ────────────────────────────────────────
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      return roundAccounting(sum + calcLineTotal(item.quantity, item.unitPrice))
    }, 0)
  }, [cart])

  const computedDiscount = useMemo(() => {
    return calcDiscount(subtotal, discountType, discountValue)
  }, [subtotal, discountType, discountValue])

  const preRoundTotal = useMemo(() => {
    return Math.max(0, roundAccounting(subtotal - computedDiscount))
  }, [subtotal, computedDiscount])

  const roundOffDeficit = useMemo(() => {
    if (preRoundTotal <= 0) return 0
    return roundAccounting(preRoundTotal % 10)
  }, [preRoundTotal])

  const applyQuickRoundOff = useCallback(() => {
    if (roundOffDeficit > 0) {
      setRoundOff(roundOffDeficit)
    } else {
      setRoundOff(0)
    }
  }, [roundOffDeficit])

  const boundedRoundOff = useMemo(() => {
    return Math.max(0, Math.min(50, roundOff || 0))
  }, [roundOff])

  const finalTotalAmount = useMemo(() => {
    return Math.max(0, roundAccounting(preRoundTotal - boundedRoundOff))
  }, [preRoundTotal, boundedRoundOff])

  const prevCartLengthRef = useRef<number>(cart.length)
  const prevTotalRef = useRef<number>(finalTotalAmount)

  // Reactive sync when cart is modified (deletions, quantity reductions, or cart emptied)
  useLayoutEffect(() => {
    const prevLength = prevCartLengthRef.current
    const prevTotal = prevTotalRef.current
    const isCartEmpty = cart.length === 0
    const isCartShrunk = cart.length < prevLength

    if (isCartEmpty) {
      if (roundOff !== 0) setRoundOff(0)
      if (cashPaidInput !== "") setCashPaidInput("")
      if (dueAmountInput !== "") setDueAmountInput("")
      if (digitalPaidInput !== "") setDigitalPaidInput("")
    } else if (isCartShrunk) {
      // A product was deleted from the cart:
      // 1. Refresh Auto Round: if auto-round was applied, recompute with the new roundOffDeficit
      if (roundOff > 0) {
        const nextDeficit = roundAccounting(preRoundTotal % 10)
        setRoundOff(nextDeficit > 0 ? nextDeficit : 0)
      }

      // 2. Refresh Cash Tender:
      // If cash input matched the previous total (exact cash mode), sync to new final total!
      const currentCash = parseFloat(cashPaidInput) || 0
      if (currentCash === prevTotal && finalTotalAmount > 0) {
        setCashPaidInput(String(finalTotalAmount))
      } else if (currentCash > 0) {
        // Otherwise, refresh cash input so cashier enters clean received tender for new total
        setCashPaidInput("")
      }

      // 3. Refresh Due Tender:
      if (paymentMethod === "DUE") {
        setDueAmountInput(finalTotalAmount > 0 ? String(finalTotalAmount) : "")
      }
    } else if (roundOff > 0 && preRoundTotal > 0) {
      // Re-evaluate roundOff if total changed so it never over-deducts
      const currentDeficit = roundAccounting(preRoundTotal % 10)
      if (roundOff !== currentDeficit) {
        setRoundOff(currentDeficit > 0 ? currentDeficit : 0)
      }
    }

    prevCartLengthRef.current = cart.length
    prevTotalRef.current = finalTotalAmount
  }, [cart, preRoundTotal, roundOff, cashPaidInput, finalTotalAmount, paymentMethod, dueAmountInput])

  // Auto-sync digital tender when payment method or total changes.
  // Note: cashPaidInput is deliberately NOT pre-filled so cashiers can type
  // received cash denominations directly without having to delete prefilled text.
  useLayoutEffect(() => {
    if (paymentMethod === "CASH") {
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
      setDueAmountInput((prev) => {
        if (!prev || prev.trim() === "") {
          return finalTotalAmount > 0 ? String(finalTotalAmount) : ""
        }
        const num = parseFloat(prev) || 0
        if (num > finalTotalAmount) {
          return finalTotalAmount > 0 ? String(finalTotalAmount) : ""
        }
        return prev
      })
    }
  }, [paymentMethod, finalTotalAmount])

  const dueAmount = useMemo(() => {
    if (paymentMethod !== "DUE") return 0
    if (dueAmountInput.trim() === "") return finalTotalAmount
    const parsed = parseFloat(dueAmountInput)
    if (isNaN(parsed) || parsed < 0) return finalTotalAmount
    return Math.min(finalTotalAmount, parsed)
  }, [paymentMethod, dueAmountInput, finalTotalAmount])

  const cashPaid = useMemo(() => {
    if (paymentMethod === "DUE") {
      return roundAccounting(Math.max(0, finalTotalAmount - dueAmount))
    }
    if (paymentMethod === "CASH" && cashPaidInput.trim() === "") {
      return 0
    }
    return Math.max(0, parseFloat(cashPaidInput) || 0)
  }, [paymentMethod, dueAmount, cashPaidInput, finalTotalAmount])

  const digitalPaid = useMemo(() => {
    return Math.max(0, parseFloat(digitalPaidInput) || 0)
  }, [digitalPaidInput])

  const totalPaid = useMemo(() => {
    return roundAccounting(cashPaid + digitalPaid)
  }, [cashPaid, digitalPaid])

  const liveDue = useMemo(() => {
    return Math.max(0, roundAccounting(finalTotalAmount - totalPaid))
  }, [finalTotalAmount, totalPaid])

  const changeToReturn = useMemo(() => {
    return calcChangeReturn(totalPaid, finalTotalAmount)
  }, [finalTotalAmount, totalPaid])


  const totalPurchaseCost = useMemo(() => {
    return cart.reduce((sum, item) => {
      return roundAccounting(sum + roundAccounting(item.purchaseCost * item.quantity))
    }, 0)
  }, [cart])

  const totalGrossProfit = useMemo(() => {
    return calcGrossProfit(finalTotalAmount, totalPurchaseCost, 1).profit
  }, [finalTotalAmount, totalPurchaseCost])

  const grossProfitMargin = useMemo(() => {
    return calcGrossProfit(finalTotalAmount, totalPurchaseCost, 1).marginPct
  }, [finalTotalAmount, totalPurchaseCost])


  const totalItemsCount = cart.length
  const totalUnitsCount = useMemo(() => {
    return cart.reduce((sum, i) => roundAccounting(sum + i.quantity), 0)
  }, [cart])

  // ─── Cart Item Operations ──────────────────────────────────────────
  const addToCart = useCallback(
    (
      stockOrLot: StockItem | (InventoryLot & Partial<StockItem>),
      allLots: InventoryLot[] = [],
    ) => {
      // Find candidate FEFO lot (earliest expiry). InventoryLot objects carry an
      // "id" field; StockItem rows also expose lotRetailPrice/lotNumber (they're a
      // flattened product+lot DTO) but their own identifier field is "lotId", not
      // "id" — so "id" is the only reliable discriminator between the two shapes.
      const isLot = "id" in stockOrLot
      let targetLot: InventoryLot

      if (isLot) {
        targetLot = stockOrLot as InventoryLot
      } else {
        const productLots =
          allLots.length > 0
            ? allLots
            : "lotId" in stockOrLot
              ? [
                  {
                    id: (stockOrLot as any).lotId,
                    productId: stockOrLot.productId,
                    productCode: stockOrLot.productCode,
                    productNameEn: stockOrLot.productNameEn || stockOrLot.nameEn,
                    lotNumber: formatLotNumber((stockOrLot as any).lotNumber, 0),
                    entryDate: (stockOrLot as any).entryDate || new Date().toISOString(),
                    expiryDate: (stockOrLot as any).expiryDate || "2099-12-31",
                    purchaseCost: (stockOrLot as any).purchaseCost || 0,
                    lotRetailPrice: (stockOrLot as any).lotRetailPrice || stockOrLot.standardRetailPrice || 0,
                    lotWholesalePrice: (stockOrLot as any).lotWholesalePrice || stockOrLot.standardWholesalePrice || 0,
                    barcode: (stockOrLot as any).lotBarcode || (stockOrLot as any).barcode || "",
                  },
                ]
              : []

        const sortedLots = [...productLots].sort(
          (a, b) =>
            new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime(),
        )
        targetLot = sortedLots[0] || {
          id: (stockOrLot as any).lotId || stockOrLot.productId,
          productId: stockOrLot.productId,
          productCode: stockOrLot.productCode,
          productNameEn: stockOrLot.productNameEn || stockOrLot.nameEn,
          lotNumber: formatLotNumber((stockOrLot as any).lotNumber, 0),
          entryDate: new Date().toISOString(),
          expiryDate: "2099-12-31",
          purchaseCost: (stockOrLot as any).purchaseCost || 0,
          lotRetailPrice: stockOrLot.standardRetailPrice || 0,
          lotWholesalePrice: stockOrLot.standardWholesalePrice || 0,
          barcode: stockOrLot.defaultBarcode || "",
        }
      }

      const defaultPrice =
        saleMode === "WHOLESALE"
          ? (targetLot.lotWholesalePrice || targetLot.lotRetailPrice)
          : targetLot.lotRetailPrice

      setCart((prevCart) => {
        const existingIndex = prevCart.findIndex((i) => i.lotId === targetLot.id)

        if (existingIndex > -1) {
          return prevCart.map((item, idx) => {
            if (idx !== existingIndex) return item
            const newQty = clampToAvailable(roundAccounting(item.quantity + 1), item)
            if (newQty <= 0) return item
            return {
              ...item,
              quantity: newQty,
            }
          })
        }

        const availableStock =
          (stockOrLot as any).quantity ?? (stockOrLot as any).totalQuantity ?? 0
        const initialQuantity = clampToAvailable(1, { availableStock })
        if (initialQuantity <= 0) return prevCart

        const newItem: CartItem = {
          id: `cart-${targetLot.id}-${Date.now()}`,
          productId: stockOrLot.productId,
          productCode: stockOrLot.productCode || "",
          nameEn: stockOrLot.productNameEn || stockOrLot.nameEn || "",
          nameBn: stockOrLot.productNameBn || stockOrLot.nameBn || "",
          category: stockOrLot.category,
          baseUnit: stockOrLot.baseUnit || "Piece",
          packSize: (stockOrLot as any).packSize || null,
          unitSize: (stockOrLot as any).unitSize || null,
          cartonMultiplier: Number(stockOrLot.cartonMultiplier) || 1,
          cartonWholesalePrice: Number((stockOrLot as any).cartonWholesalePrice) || null,
          cartonBuyingPrice: Number((stockOrLot as any).cartonBuyingPrice) || null,
          defaultBarcode: stockOrLot.defaultBarcode,
          lotId: targetLot.id,
          lotNumber: targetLot.lotNumber,
          entryDate: targetLot.entryDate,
          expiryDate: targetLot.expiryDate,
          purchaseCost: targetLot.purchaseCost,
          lotRetailPrice: targetLot.lotRetailPrice,
          lotWholesalePrice: targetLot.lotWholesalePrice,
          barcode: targetLot.barcode,
          availableStock,
          quantity: initialQuantity,
          unitPrice: defaultPrice,
          originalUnitPrice: defaultPrice,
          availableLots: allLots.length > 0 ? allLots : undefined,
        }

        return [newItem, ...prevCart]
      })
    },
    [saleMode],
  )

  const adjustQuantity = useCallback((itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id !== itemId) return item
          const newQty = roundAccounting(item.quantity + delta)
          if (newQty <= 0) return null
          const clampedQty = clampToAvailable(newQty, item)
          if (clampedQty <= 0) return null
          return {
            ...item,
            quantity: clampedQty,
          }
        })
        .filter((item): item is CartItem => item !== null),
    )
  }, [])

  const setQuantity = useCallback((itemId: string, val: number) => {
    if (isNaN(val) || val <= 0) return
    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item
        const cleanQty = clampToAvailable(roundAccounting(val), item)
        if (cleanQty <= 0) return item
        return {
          ...item,
          quantity: cleanQty,
        }
      }),
    )
  }, [])

  const setUnitPrice = useCallback((itemId: string, price: number) => {
    if (isNaN(price) || price < 0) return
    const cleanPrice = roundAccounting(price)
    setCart((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, unitPrice: cleanPrice } : item,
      ),
    )
  }, [])

  const selectLot = useCallback(
    (itemId: string, newLot: InventoryLot, availableStock?: number) => {
      setCart((prev) =>
        prev.map((item) => {
          if (item.id !== itemId) return item
          const defaultPrice =
            saleMode === "WHOLESALE"
              ? (newLot.lotWholesalePrice || newLot.lotRetailPrice)
              : newLot.lotRetailPrice
          const nextAvailableStock =
            availableStock !== undefined ? availableStock : item.availableStock
          const nextQuantity = clampToAvailable(item.quantity, {
            availableStock: nextAvailableStock,
          })
          if (nextQuantity <= 0) return item
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
            availableStock:
              nextAvailableStock,
            quantity: nextQuantity,
            unitPrice: defaultPrice,
            originalUnitPrice: defaultPrice,
          }
        }),
      )
    },
    [saleMode],
  )

  const removeItem = useCallback((itemId: string) => {
    setCart((prev) => {
      const next = prev.filter((i) => i.id !== itemId)
      if (next.length === 0) {
        setRoundOff(0)
        setCashPaidInput("")
        setDueAmountInput("")
        setDigitalPaidInput("")
      }
      return next
    })
  }, [])

  const clearCart = useCallback(() => {
    setCart([])
    setDiscountValue("")
    setRoundOff(0)
    setCashPaidInput("")
    setDueAmountInput("")
    setDigitalPaidInput("")
    setDigitalTrxId("")
    setSelectedCustomerId(null)
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignore
    }
  }, [])

  const toggleSaleMode = useCallback((newMode: SaleMode) => {
    setSaleMode(newMode)
    setCart((prev) =>
      prev.map((item) => {
        const nextPrice =
          newMode === "WHOLESALE"
            ? (item.lotWholesalePrice || item.unitPrice)
            : (item.lotRetailPrice || item.unitPrice)
        return {
          ...item,
          unitPrice: nextPrice,
          originalUnitPrice: nextPrice,
        }
      }),
    )
  }, [])

  return (
    <CartContext.Provider
      value={{
        cart,
        saleMode,
        setSaleMode: toggleSaleMode,
        toggleSaleMode,
        selectedCustomerId,
        setSelectedCustomerId,
        discountType,
        setDiscountType,
        discountValue,
        setDiscountValue,
        roundOff,
        setRoundOff,
        roundOffDeficit,
        applyQuickRoundOff,
        paymentMethod,
        setPaymentMethod,
        cashPaidInput,
        setCashPaidInput,
        dueAmountInput,
        setDueAmountInput,
        digitalPaidInput,
        setDigitalPaidInput,
        digitalMedium,
        setDigitalMedium,
        digitalTrxId,
        setDigitalTrxId,
        addToCart,
        adjustQuantity,
        setQuantity,
        setUnitPrice,
        selectLot,
        removeItem,
        clearCart,
        subtotal,
        computedDiscount,
        preRoundTotal,
        finalTotalAmount,
        dueAmount,
        cashPaid,
        digitalPaid,
        totalPaid,
        liveDue,
        changeToReturn,
        totalPurchaseCost,
        totalGrossProfit,
        grossProfitMargin,
        totalItemsCount,
        totalUnitsCount,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart(): CartContextType {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error("useCart must be used within a CartProvider")
  }
  return context
}
