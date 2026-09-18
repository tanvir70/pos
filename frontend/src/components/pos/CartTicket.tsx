import { Receipt, Trash2, ShoppingCart, X } from "lucide-react"
import { useCart } from "../../context/CartContext"
import { formatTk, calcLineTotal } from "../../utils/currency"
import Button from "../ui/Button"

export interface CartTicketProps {
  isOwner?: boolean
}

export default function CartTicket({ isOwner = false }: CartTicketProps) {
  const {
    cart,
    adjustQuantity,
    setQuantity,
    removeItem,
    clearCart,
    totalItemsCount,
    totalUnitsCount,
  } = useCart()

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Ticket Header */}
      <div className="px-4 py-3 border-b border-slate-200/60 bg-slate-50/40 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-slate-700" />
          <div>
            <h3 className="font-bold text-sm text-slate-900 leading-tight">
              Current Order Ticket
            </h3>
            <p className="text-[11px] text-slate-500">
              Total: <span className="font-bold font-mono">{totalItemsCount}</span> items (
              <span className="font-bold font-mono">{totalUnitsCount}</span> units)
            </p>
          </div>
        </div>

        {cart.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearCart}
            className="text-red-700 hover:bg-red-50 text-xs px-2.5 py-1"
            title="Clear all items"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </Button>
        )}
      </div>

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {cart.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 p-6 text-center">
            <ShoppingCart className="w-10 h-10 mb-2 text-slate-300" />
            <p className="text-sm font-bold text-slate-900">
              Cart is still empty
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-[220px]">
              Scan a product with the barcode scanner or add one from the catalog on the left.
            </p>
          </div>
        ) : (
          cart.map((item) => {
            const lineTotal = calcLineTotal(item.quantity, item.unitPrice)
            const linePurchaseCost = item.purchaseCost * item.quantity
            const lineProfit = lineTotal - linePurchaseCost

            return (
              <div
                key={item.id}
                className="p-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl shadow-xs transition-all space-y-2"
              >
                {/* Row 1: Title & Delete */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs sm:text-sm text-slate-900 leading-tight truncate">
                        {item.nameEn || item.nameBn}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-50 font-mono font-semibold text-slate-500 border border-slate-200">
                        {item.baseUnit}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 truncate block">
                      {item.nameBn}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="shrink-0 p-1 text-slate-500 hover:text-red-600 rounded-md hover:bg-red-50 cursor-pointer transition-colors text-xs"
                    title="Remove"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Row 2: Stepper + Price (read-only) + Line Total */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/40">
                  {/* Quantity Stepper */}
                  <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50/40 shrink-0">
                    <button
                      type="button"
                      onClick={() => adjustQuantity(item.id, -1)}
                      className="w-7 h-7 flex items-center justify-center font-bold text-base hover:bg-slate-100 active:bg-slate-200 transition-colors cursor-pointer select-none"
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
                      className="w-12 h-7 text-center font-mono font-bold text-xs bg-white border-x border-slate-200 focus:outline-hidden tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() => adjustQuantity(item.id, 1)}
                      className="w-7 h-7 flex items-center justify-center font-bold text-base hover:bg-slate-100 active:bg-slate-200 transition-colors cursor-pointer select-none"
                    >
                      +
                    </button>
                  </div>

                  {/* Unit Price (read-only) */}
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-slate-500">Price:</span>
                    <span className="text-xs font-mono font-bold px-1.5 py-0.5 text-slate-900">
                      {formatTk(item.unitPrice)}
                    </span>
                  </div>

                  {/* Line Total */}
                  <div className="text-right shrink-0">
                    <div className="font-mono font-black text-sm text-slate-900 tabular-nums">
                      {formatTk(lineTotal)}
                    </div>
                  </div>
                </div>

                {/* Owner Mode Hint: Purchase Cost & Profit */}
                {isOwner && (
                  <div className="pt-1.5 border-t border-dashed border-amber-200 flex items-center justify-between text-[11px] text-amber-900 font-semibold bg-amber-50/50 -mx-3 -mb-3 px-3 py-1 rounded-b-xl">
                    <span>
                      Cost: {formatTk(item.purchaseCost)} × {item.quantity} ={" "}
                      {formatTk(linePurchaseCost)}
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        lineProfit >= 0 ? "text-emerald-800" : "text-red-600"
                      }`}
                    >
                      Profit: {formatTk(lineProfit)}
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
