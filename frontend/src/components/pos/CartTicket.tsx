import { useState } from "react"
import type { CartItem, InventoryLot, StockItem } from "../../types"
import { useCart } from "../../context/CartContext"
import { formatTk, calcLineTotal } from "../../utils/currency"
import LotSelectorDropdown from "../LotSelectorDropdown"
import Button from "../ui/Button"

export interface CartTicketProps {
  isOwner?: boolean
  stocks?: StockItem[]
}

export default function CartTicket({
  isOwner = false,
  stocks = [],
}: CartTicketProps) {
  const {
    cart,
    adjustQuantity,
    setQuantity,
    setUnitPrice,
    selectLot,
    removeItem,
    clearCart,
    totalItemsCount,
    totalUnitsCount,
  } = useCart()

  const [editingPriceItemId, setEditingPriceItemId] = useState<string | null>(null)
  const [tempPriceInput, setTempPriceInput] = useState<string>("")

  const handleStartPriceEdit = (item: CartItem) => {
    setEditingPriceItemId(item.id)
    setTempPriceInput(String(item.unitPrice))
  }

  const handleSavePriceEdit = (itemId: string) => {
    const parsed = parseFloat(tempPriceInput)
    if (!isNaN(parsed) && parsed >= 0) {
      setUnitPrice(itemId, parsed)
    }
    setEditingPriceItemId(null)
  }

  // Extract available lots for a product from stocks if availableLots is not on the item
  const getProductLots = (item: CartItem): InventoryLot[] => {
    if (item.availableLots && item.availableLots.length > 0) {
      return item.availableLots
    }
    return stocks
      .filter((s) => s.productId === item.productId)
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
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-frost-border shadow-xs overflow-hidden">
      {/* Ticket Header */}
      <div className="px-4 py-3 border-b border-frost-border/60 bg-frost-surface/40 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🧾</span>
          <div>
            <h3 className="font-bold text-sm text-frost-dark bn-text leading-tight">
              চলতি বিল রশিদ
            </h3>
            <p className="text-[11px] text-frost-muted bn-text">
              মোট: <span className="font-bold font-mono">{totalItemsCount}</span> টি পণ্য (
              <span className="font-bold font-mono">{totalUnitsCount}</span> ইউনিট)
            </p>
          </div>
        </div>

        {cart.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearCart}
            className="text-red-700 hover:bg-red-50 text-xs px-2.5 py-1"
            title="সব আইটেম মুছুন"
          >
            🗑️ সব মুছুন
          </Button>
        )}
      </div>

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {cart.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-frost-muted p-6 text-center">
            <span className="text-4xl mb-2">🛒</span>
            <p className="text-sm font-bold text-frost-dark bn-text">
              কার্ট এখনো খালি রয়েছে
            </p>
            <p className="text-xs text-frost-muted bn-text mt-1 max-w-[220px]">
              বারকোড স্ক্যানার দিয়ে স্ক্যান করুন অথবা বাম পাশের তালিকা থেকে পণ্য যোগ করুন।
            </p>
          </div>
        ) : (
          cart.map((item) => {
            const lineTotal = calcLineTotal(item.quantity, item.unitPrice)
            const isPriceModified =
              item.originalUnitPrice !== undefined &&
              item.unitPrice !== item.originalUnitPrice
            const availableLots = getProductLots(item)

            const linePurchaseCost = item.purchaseCost * item.quantity
            const lineProfit = lineTotal - linePurchaseCost

            return (
              <div
                key={item.id}
                className="p-3 bg-white border border-frost-border hover:border-frost-border/80 rounded-xl shadow-xs transition-all space-y-2"
              >
                {/* Row 1: Title & Delete */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs sm:text-sm text-frost-dark bn-text leading-tight truncate">
                        {item.nameBn}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-frost-surface font-mono font-semibold text-frost-muted border border-frost-border">
                        {item.baseUnit}
                      </span>
                      {isPriceModified && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold bn-text border border-amber-300">
                          দর পরিবর্তন
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-frost-muted truncate block">
                      {item.nameEn}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="shrink-0 p-1 text-frost-muted hover:text-red-600 rounded-md hover:bg-red-50 cursor-pointer transition-colors text-xs"
                    title="মুছুন"
                  >
                    ✕
                  </button>
                </div>

                {/* Row 2: Lot Selector */}
                <div className="flex items-center justify-between gap-2 text-xs pt-1 border-t border-frost-border/40">
                  <span className="text-[11px] text-frost-muted bn-text font-medium">
                    লট/ব্যাচ:
                  </span>
                  <LotSelectorDropdown
                    lots={availableLots}
                    selectedLotId={item.lotId}
                    onSelectLot={(newLot) => selectLot(item.id, newLot)}
                    isOwner={isOwner}
                  />
                </div>

                {/* Row 3: Stepper + Bargaining Price + Line Total */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-frost-border/40">
                  {/* Quantity Stepper */}
                  <div className="flex items-center border border-frost-border rounded-lg overflow-hidden bg-frost-surface/40 shrink-0">
                    <button
                      type="button"
                      onClick={() => adjustQuantity(item.id, -1)}
                      className="w-7 h-7 flex items-center justify-center font-bold text-base hover:bg-frost-hover active:bg-slate-200 transition-colors cursor-pointer select-none"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      step="any"
                      min="0.001"
                      value={item.quantity}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value)
                        if (!isNaN(val) && val > 0) setQuantity(item.id, val)
                      }}
                      className="w-12 h-7 text-center font-mono font-bold text-xs bg-white border-x border-frost-border focus:outline-hidden tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() => adjustQuantity(item.id, 1)}
                      className="w-7 h-7 flex items-center justify-center font-bold text-base hover:bg-frost-hover active:bg-slate-200 transition-colors cursor-pointer select-none"
                    >
                      +
                    </button>
                  </div>

                  {/* Unit Price (Bargaining editable) */}
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-frost-muted bn-text">দর:</span>
                    {editingPriceItemId === item.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="any"
                          value={tempPriceInput}
                          onChange={(e) => setTempPriceInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSavePriceEdit(item.id)
                            if (e.key === "Escape") setEditingPriceItemId(null)
                          }}
                          className="w-16 py-0.5 px-1.5 text-xs font-mono font-bold border border-emerald-500 rounded bg-white focus:outline-hidden"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSavePriceEdit(item.id)}
                          className="text-xs text-emerald-800 font-bold px-1 py-0.5 hover:bg-emerald-50 rounded cursor-pointer"
                        >
                          ✓
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStartPriceEdit(item)}
                        className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded border border-dashed transition-colors cursor-pointer ${
                          isPriceModified
                            ? "bg-amber-50 text-amber-900 border-amber-400 hover:bg-amber-100"
                            : "bg-frost-surface/60 text-frost-dark border-frost-border hover:border-frost-dark"
                        }`}
                        title="দর পরিবর্তন করতে ক্লিক করুন (দর কষাকষি)"
                      >
                        ৳{item.unitPrice} ✏️
                      </button>
                    )}
                  </div>

                  {/* Line Total */}
                  <div className="text-right shrink-0">
                    <div className="font-mono font-black text-sm text-frost-dark tabular-nums">
                      {formatTk(lineTotal)}
                    </div>
                  </div>
                </div>

                {/* Owner Mode Hint: Purchase Cost & Profit */}
                {isOwner && (
                  <div className="pt-1.5 border-t border-dashed border-amber-200 flex items-center justify-between text-[11px] text-amber-900 font-semibold bn-text bg-amber-50/50 -mx-3 -mb-3 px-3 py-1 rounded-b-xl">
                    <span>
                      কেনা: {formatTk(item.purchaseCost)} × {item.quantity} ={" "}
                      {formatTk(linePurchaseCost)}
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        lineProfit >= 0 ? "text-emerald-800" : "text-red-600"
                      }`}
                    >
                      লাভ: {formatTk(lineProfit)}
                    </span>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
