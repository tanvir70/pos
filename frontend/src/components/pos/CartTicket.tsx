import {
  Minus,
  PackageOpen,
  Plus,
  ReceiptText,
  Trash2,
  X,
} from "lucide-react"
import { useCart } from "../../context/CartContext"
import { useToast } from "../../context/ToastContext"
import { calcLineTotal, formatTk } from "../../utils/currency"

function hasBusinessLot(lotNumber?: string) {
  return !!lotNumber
}

export default function CartTicket() {
  const { showWarning } = useToast()
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
    <section className="flex min-h-0 flex-1 flex-col bg-white">
      <header className="flex min-h-[66px] items-center justify-between gap-4 border-b border-slate-200 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
            <ReceiptText className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-bold text-slate-950">Current order</h2>
              <span className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                Live
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              <span className="font-mono font-bold text-slate-700">{totalItemsCount}</span>{" "}
              items /{" "}
              <span className="font-mono font-bold text-slate-700">{totalUnitsCount}</span>{" "}
              units
            </p>
          </div>
        </div>

        {cart.length > 0 && (
          <button
            type="button"
            onClick={clearCart}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold text-slate-500 hover:bg-red-50 hover:text-red-700 cursor-pointer"
            title="Clear the current order"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Clear order</span>
          </button>
        )}
      </header>

      {cart.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400">
            <PackageOpen className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-sm font-bold text-slate-900">Ready for a new order</h3>
          <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
            Scan a product barcode or search above. Selected items will appear here
            immediately.
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="sticky top-0 z-10 hidden grid-cols-[minmax(150px,1fr)_124px_84px_96px_32px] items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-bold uppercase text-slate-500 md:grid">
            <span>Item</span>
            <span className="text-center">Quantity</span>
            <span className="text-right">Unit price</span>
            <span className="text-right">Total</span>
            <span className="sr-only">Remove</span>
          </div>

          <div className="divide-y divide-slate-100">
            {cart.map((item, index) => {
              const lineTotal = calcLineTotal(item.quantity, item.unitPrice)
              const availableStock = Number.isFinite(Number(item.availableStock))
                ? Math.max(0, Number(item.availableStock))
                : 0
              const isAtStockLimit = item.quantity >= availableStock
              const stockLimitMessage = `Only ${availableStock} ${item.baseUnit} available in stock.`

              return (
                <article
                  key={item.id}
                  className="relative grid gap-3 px-4 py-4 hover:bg-slate-50/70 md:grid-cols-[minmax(150px,1fr)_124px_84px_96px_32px] md:items-center"
                >
                  <div className="flex min-w-0 items-start gap-3 pr-9 md:pr-0">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 font-mono text-[10px] font-bold text-slate-500">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-slate-950">
                        {item.nameEn || item.nameBn}
                      </h3>
                      {item.nameBn && item.nameBn !== item.nameEn && (
                        <p className="truncate text-xs text-slate-500">{item.nameBn}</p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
                        <span className="font-mono">{item.productCode}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        <span>{item.baseUnit}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        <span>{availableStock} in selected lot</span>
                        {hasBusinessLot(item.lotNumber) && (
                          <>
                            <span className="h-1 w-1 rounded-full bg-slate-300" />
                            <span>Lot {item.lotNumber}</span>
                            <span className="h-1 w-1 rounded-full bg-slate-300" />
                            <span>Exp {item.expiryDate || "Not set"}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 md:justify-center">
                    <span className="text-[10px] font-bold uppercase text-slate-400 md:hidden">
                      Quantity
                    </span>
                    <div className="grid h-9 w-[120px] grid-cols-[36px_48px_36px] overflow-hidden rounded-lg border border-slate-300 bg-white">
                      <button
                        type="button"
                        onClick={() => adjustQuantity(item.id, -1)}
                        className="flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-950 cursor-pointer"
                        aria-label={`Reduce ${item.nameEn || item.nameBn} quantity`}
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={item.quantity}
                        onChange={(event) => {
                          const value = Number.parseFloat(event.target.value)
                          if (Number.isFinite(value) && value > 0) {
                            if (value > availableStock) {
                              showWarning(stockLimitMessage, "Stock limit reached")
                            }
                            setQuantity(item.id, value)
                          }
                        }}
                        className="min-w-0 border-x border-slate-200 bg-white text-center font-mono text-xs font-bold text-slate-950 outline-hidden tabular-nums"
                        aria-label={`${item.nameEn || item.nameBn} quantity`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (isAtStockLimit) {
                            showWarning(stockLimitMessage, "Stock limit reached")
                            return
                          }
                          adjustQuantity(item.id, 1)
                        }}
                        className={`flex items-center justify-center cursor-pointer ${
                          isAtStockLimit
                            ? "bg-slate-50 text-slate-300"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                        }`}
                        aria-label={`Increase ${item.nameEn || item.nameBn} quantity`}
                        title={
                          isAtStockLimit
                            ? `Only ${availableStock} ${item.baseUnit} in stock`
                            : undefined
                        }
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:block md:text-right">
                    <span className="text-[10px] font-bold uppercase text-slate-400 md:hidden">
                      Unit price
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-700 tabular-nums">
                      {formatTk(item.unitPrice)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between md:block md:text-right">
                    <span className="text-[10px] font-bold uppercase text-slate-400 md:hidden">
                      Line total
                    </span>
                    <span className="font-mono text-sm font-black text-slate-950 tabular-nums">
                      {formatTk(lineTotal)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 md:static cursor-pointer"
                    title="Remove item"
                    aria-label={`Remove ${item.nameEn || item.nameBn}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </article>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
