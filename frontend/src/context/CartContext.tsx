import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
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

interface SavedCartState {
  cart: CartItem[]
  saleMode: SaleMode
  selectedCustomerId: number | null
  discountType: "flat" | "percent"
  discountValue: string
  roundOff: number
  paymentMethod: PaymentMethod
  cashPaidInput: string
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

  const finalTotalAmount = useMemo(() => {
    return Math.max(0, roundAccounting(preRoundTotal - roundOff))
  }, [preRoundTotal, roundOff])

  // Auto-sync cash/digital tender when payment method or total changes.
  // Uses useLayoutEffect (not useEffect) so this correction happens before the
  // browser paints: otherwise the settlement panel briefly renders with a stale
  // cashPaidInput against the new finalTotalAmount, flashing the change/due
  // badges in and out on every cart edit or discount keystroke.
  useLayoutEffect(() => {
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

  const cashPaid = useMemo(() => {
    return parseFloat(cashPaidInput) || 0
  }, [cashPaidInput])

  const digitalPaid = useMemo(() => {
    return parseFloat(digitalPaidInput) || 0
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
      // Find candidate FEFO lot (earliest expiry)
      const isLot = "lotRetailPrice" in stockOrLot && "lotNumber" in stockOrLot
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
                    lotNumber: (stockOrLot as any).lotNumber || "DEFAULT",
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
          lotNumber: (stockOrLot as any).lotNumber || "DEFAULT",
          entryDate: new Date().toISOString(),
          expiryDate: "2099-12-31",
          purchaseCost: (stockOrLot as any).purchaseCost || 0,
          lotRetailPrice: stockOrLot.standardRetailPrice || 0,
          lotWholesalePrice: stockOrLot.standardWholesalePrice || 0,
          barcode: stockOrLot.defaultBarcode || "",
        }
      }

      const defaultPrice =
        saleMode === "RETAIL"
          ? targetLot.lotRetailPrice
          : targetLot.lotWholesalePrice

      setCart((prevCart) => {
        const existingIndex = prevCart.findIndex((i) => i.lotId === targetLot.id)

        if (existingIndex > -1) {
          return prevCart.map((item, idx) => {
            if (idx !== existingIndex) return item
            const newQty = roundAccounting(item.quantity + 1)
            return {
              ...item,
              quantity: newQty,
            }
          })
        }

        const newItem: CartItem = {
          id: `cart-${targetLot.id}-${Date.now()}`,
          productId: stockOrLot.productId,
          productCode: stockOrLot.productCode,
          nameEn: stockOrLot.productNameEn || stockOrLot.nameEn,
          nameBn: stockOrLot.productNameBn || stockOrLot.nameBn,
          category: stockOrLot.category,
          baseUnit: stockOrLot.baseUnit || "Piece",
          cartonMultiplier: stockOrLot.cartonMultiplier || 1,
          defaultBarcode: stockOrLot.defaultBarcode,
          lotId: targetLot.id,
          lotNumber: targetLot.lotNumber,
          entryDate: targetLot.entryDate,
          expiryDate: targetLot.expiryDate,
          purchaseCost: targetLot.purchaseCost,
          lotRetailPrice: targetLot.lotRetailPrice,
          lotWholesalePrice: targetLot.lotWholesalePrice,
          barcode: targetLot.barcode,
          availableStock:
            (stockOrLot as any).quantity ?? (stockOrLot as any).totalQuantity ?? 0,
          quantity: 1,
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
          return {
            ...item,
            quantity: newQty,
          }
        })
        .filter((item): item is CartItem => item !== null),
    )
  }, [])

  const setQuantity = useCallback((itemId: string, val: number) => {
    if (isNaN(val) || val <= 0) return
    const cleanQty = roundAccounting(val)
    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item
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
            saleMode === "RETAIL"
              ? newLot.lotRetailPrice
              : newLot.lotWholesalePrice
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
              availableStock !== undefined ? availableStock : item.availableStock,
            unitPrice: defaultPrice,
            originalUnitPrice: defaultPrice,
          }
        }),
      )
    },
    [saleMode],
  )

  const removeItem = useCallback((itemId: string) => {
    setCart((prev) => prev.filter((i) => i.id !== itemId))
  }, [])

  const clearCart = useCallback(() => {
    setCart([])
    setDiscountValue("")
    setRoundOff(0)
    setCashPaidInput("")
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
        const standardPrice =
          newMode === "RETAIL" ? item.lotRetailPrice : item.lotWholesalePrice
        return {
          ...item,
          unitPrice: standardPrice,
          originalUnitPrice: standardPrice,
        }
      }),
    )
  }, [])

  return (
    <CartContext.Provider
      value={{
        cart,
        saleMode,
        setSaleMode,
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
