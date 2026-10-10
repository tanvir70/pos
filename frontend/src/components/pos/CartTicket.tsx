import { useState } from "react"
import {
  Clock,
  Minus,
  PackageOpen,
  PauseCircle,
  PlayCircle,
  Plus,
  ReceiptText,
  Trash2,
  X,
} from "lucide-react"
import { useCart, MAX_PARKED_CARTS, type ParkedCart } from "../../context/CartContext"
import { useToast } from "../../context/ToastContext"
import type { Customer } from "../../types"
import { calcLineTotal, formatTk } from "../../utils/currency"
import { getEffectiveMultiplier, pluralizeUnit } from "../../utils/unit"
import Badge from "../ui/Badge"
import Button from "../ui/Button"
import { Modal } from "../ui/Modal"
import { cleanProductNameBn } from "@/constants/bengaliCatalog"

function hasBusinessLot(lotNumber?: string) {
  return !!lotNumber
}

function formatParkedAge(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  if (diffSec < 60) return "Just now"
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  return `${diffHr}h ago`
}

export interface CartTicketProps {
  customers?: Customer[]
}

export default function CartTicket({ customers }: CartTicketProps = {}) {
  const { showSuccess, showWarning } = useToast()
  const {
    cart,
    selectedCustomerId,
    adjustQuantity,
    setQuantity,
    removeItem,
    clearCart,
    parkedCarts,
    parkCurrentCart,
    recallParkedCart,
    deleteParkedCart,
    totalItemsCount,
    totalUnitsCount,
  } = useCart()

  const [isParkedModalOpen, setIsParkedModalOpen] = useState(false)

  const handleHoldCurrentCart = () => {
    if (cart.length === 0) return
    const activeCustomer = customers?.find((c) => c.id === selectedCustomerId)
    const label =
      activeCustomer?.name ||
      (selectedCustomerId ? `Customer #${selectedCustomerId}` : "Walk-in")

    const success = parkCurrentCart(label)
    if (success) {
      showSuccess(
        `Order held for ${label}. Counter is ready for the next customer.`,
        "Order Held",
      )
    } else {
      showWarning(
        `Maximum ${MAX_PARKED_CARTS} held orders reached. Please resume or clear an existing one first.`,
        "Hold limit reached",
      )
    }
  }

  const handleRecallOrder = (parked: ParkedCart) => {
    if (cart.length > 0) {
      if (parkedCarts.length >= MAX_PARKED_CARTS) {
        showWarning(
          "Cannot hold active cart because all hold slots are full. Clear active cart or discard a held ticket first.",
        )
        return
      }
      const activeCustomer = customers?.find((c) => c.id === selectedCustomerId)
      const label =
        activeCustomer?.name ||
        (selectedCustomerId ? `Customer #${selectedCustomerId}` : "Walk-in")
      parkCurrentCart(label)
    }

    const ok = recallParkedCart(parked.id)
    if (ok) {
      showSuccess(
        `Resumed order for ${parked.customerName || "Walk-in"} (${parked.itemCount} items, ${formatTk(parked.totalAmount)})`,
        "Order Resumed",
      )
      setIsParkedModalOpen(false)
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-white dark:bg-slate-900">
      <header className="flex min-h-[66px] flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 dark:bg-slate-800 text-white">
            <ReceiptText className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-bold text-slate-950 dark:text-slate-100">
                Current order
              </h2>
              <Badge variant="emerald" className="px-1.5 py-0 text-[10px] font-bold uppercase">
                Live
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                {totalItemsCount}
              </span>{" "}
              items /{" "}
              <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                {totalUnitsCount}
              </span>{" "}
              units
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {parkedCarts.length > 0 && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsParkedModalOpen(true)}
              leftIcon={<Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />}
              className="text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 hover:bg-amber-100 dark:hover:bg-amber-900/60 cursor-pointer h-8 px-2.5"
              title="View held tickets waiting to be resumed"
            >
              <span>Held ({parkedCarts.length})</span>
            </Button>
          )}

          {cart.length > 0 && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleHoldCurrentCart}
                leftIcon={<PauseCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />}
                className="text-xs font-semibold text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:border-amber-300 dark:hover:border-amber-800 cursor-pointer h-8 px-2.5"
                title="Hold this order to serve the next customer in line (F4)"
              >
                <span className="hidden sm:inline">Hold order</span>
                <span className="sm:hidden">Hold</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearCart}
                leftIcon={<Trash2 className="h-3.5 w-3.5 text-slate-400 group-hover:text-red-600 dark:group-hover:text-red-400" />}
                className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700 dark:hover:text-red-300 cursor-pointer h-8 px-2.5"
                title="Clear the current order"
              >
                <span className="hidden sm:inline">Clear</span>
              </Button>
            </>
          )}
        </div>
      </header>

      {cart.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center sm:px-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500">
            <PackageOpen className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-sm font-bold text-slate-950 dark:text-slate-100">
            Ready for a new order
          </h3>
          <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500 dark:text-slate-400">
            Scan a product barcode or search above. Selected items will appear here immediately.
          </p>

          {parkedCarts.length > 0 && (
            <div className="mt-6 w-full max-w-md rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/30 p-4 text-left shadow-2xs">
              <div className="flex items-center justify-between pb-2 border-b border-amber-200/80 dark:border-amber-900/60">
                <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900 dark:text-amber-200">
                  <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Held Orders Waiting ({parkedCarts.length}/{MAX_PARKED_CARTS})</span>
                </div>
                <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                  Click to resume
                </span>
              </div>
              <div className="mt-2.5 divide-y divide-amber-200/60 dark:divide-amber-900/40">
                {parkedCarts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2.5 gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                          {p.customerName || "Walk-in"}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                          {formatParkedAge(p.parkedAt)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-300 font-mono mt-0.5">
                        {p.itemCount} item{p.itemCount === 1 ? "" : "s"} • {formatTk(p.totalAmount)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleRecallOrder(p)}
                        leftIcon={<PlayCircle className="h-3.5 w-3.5" />}
                        className="h-7 px-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-2xs"
                      >
                        Resume
                      </Button>
                      <button
                        type="button"
                        onClick={() => deleteParkedCart(p.id)}
                        className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                        title="Discard held order"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="sticky top-0 z-10 hidden grid-cols-[minmax(150px,1fr)_160px_84px_96px_32px] items-center gap-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 px-4 py-2 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 md:grid">
            <span>Item</span>
            <span className="text-center">Quantity</span>
            <span className="text-right">Unit price</span>
            <span className="text-right">Total</span>
            <span className="sr-only">Remove</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {cart.map((item, index) => {
              const currQty = Number(item.quantity) || 0
              const lineTotal = calcLineTotal(currQty, item.unitPrice)
              const availableStock = Number.isFinite(Number(item.availableStock))
                ? Math.max(0, Number(item.availableStock))
                : 0
              const isAtStockLimit = currQty >= availableStock
              const stockLimitMessage = `Only ${availableStock} ${pluralizeUnit(item.baseUnit, availableStock)} available in stock.`
              const multiplier = getEffectiveMultiplier(item.cartonMultiplier, item.packSize)
              const hasCartons = multiplier > 1
              const ctns = hasCartons ? Math.floor(currQty / multiplier) : 0
              const loose = hasCartons ? Math.round((currQty % multiplier) * 1000) / 1000 : 0

              return (
                <article
                  key={item.id}
                  className="relative grid gap-3 px-4 py-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 md:grid-cols-[minmax(150px,1fr)_160px_84px_96px_32px] md:items-center"
                >
                  <div className="flex min-w-0 items-start gap-3 pr-9 md:pr-0">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 font-mono text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="truncate text-sm font-bold text-slate-950 dark:text-slate-100">
                          {item.nameEn || item.nameBn}
                        </h3>
                        {item.packSize && (
                          <span className="shrink-0 rounded bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            {item.packSize}
                          </span>
                        )}
                        {hasCartons && (
                          <span
                            className="shrink-0 rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                            title={`1 Carton = ${multiplier} ${pluralizeUnit(item.baseUnit, multiplier)}`}
                          >
                            1 Ctn = {multiplier} {pluralizeUnit(item.baseUnit, multiplier)}
                          </span>
                        )}
                      </div>
                      {(() => {
                        const bnText = cleanProductNameBn(item.nameBn, item.nameEn, item.productCode);
                        if (bnText && bnText !== item.nameEn) {
                          return <p className="truncate text-xs text-slate-500 dark:text-slate-400 font-bangla">{bnText}</p>;
                        }
                        return null;
                      })()}
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                        <span className="font-mono">{item.productCode}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                        <span>{item.baseUnit}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                        <span>{availableStock} in lot</span>
                        {hasBusinessLot(item.lotNumber) && (
                          <>
                            <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                            <span>Lot {item.lotNumber}</span>
                            <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                            <span>Exp {item.expiryDate || "Not set"}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-1 md:items-center">
                    <div className="flex items-center justify-between gap-2 w-full md:w-auto">
                      <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 md:hidden">
                        Quantity
                      </span>
                      <div className="flex items-center gap-1">
                        <div className="grid h-8 w-[100px] grid-cols-[30px_40px_30px] overflow-hidden rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">
                          <button
                            type="button"
                            onClick={() => adjustQuantity(item.id, -1)}
                            className="flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-950 dark:hover:text-slate-100 cursor-pointer"
                            aria-label={`Reduce ${item.nameEn || item.nameBn} quantity`}
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={item.quantity}
                            onFocus={(e) => e.target.select()}
                            onChange={(event) => {
                              const valStr = event.target.value.trim()
                              if (valStr === "") {
                                return
                              }
                              const value = Number.parseFloat(valStr)
                              if (Number.isFinite(value) && value > 0) {
                                if (value > availableStock) {
                                  showWarning(stockLimitMessage, "Stock limit reached")
                                }
                                setQuantity(item.id, value)
                              }
                            }}
                            className="min-w-0 border-x border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center font-mono text-xs font-bold text-slate-950 dark:text-slate-100 outline-hidden tabular-nums focus:bg-emerald-50/50 dark:focus:bg-emerald-950/40"
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
                                ? "bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600"
                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-950 dark:hover:text-slate-100"
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
                        {hasCartons && (
                          <button
                            type="button"
                            disabled={isAtStockLimit}
                            onClick={() => {
                              if (currQty >= availableStock) {
                                showWarning(stockLimitMessage, "Stock limit reached")
                                return
                              }

                              // Smart Carton calculation:
                              // If current quantity is loose (< 1 full carton, like 1 scanned packet):
                              // The cashier scanned 1 to register the item, but wants 1 full carton!
                              let targetQty: number
                              if (currQty < multiplier) {
                                targetQty = multiplier
                              } else if (currQty % multiplier !== 0) {
                                // Has loose units (e.g. 31 packets): check if +multiplier fits.
                                if (currQty + multiplier <= availableStock) {
                                  targetQty = currQty + multiplier
                                } else {
                                  // Next full carton boundary or capped available stock
                                  const nextCartonBoundary = Math.ceil(currQty / multiplier) * multiplier
                                  targetQty = Math.min(availableStock, nextCartonBoundary)
                                }
                              } else {
                                targetQty = currQty + multiplier
                              }

                              // Guard against stock limit
                              if (targetQty > availableStock) {
                                if (currQty < availableStock) {
                                  targetQty = availableStock
                                  setQuantity(item.id, targetQty)
                                  showSuccess(
                                    `Set to ${targetQty} ${pluralizeUnit(item.baseUnit, targetQty)} (maximum available in lot)`,
                                    "Stock adjusted",
                                  )
                                  return
                                }
                                showWarning(stockLimitMessage, "Stock limit reached")
                                return
                              }

                              setQuantity(item.id, targetQty)
                            }}
                            className={`h-8 items-center justify-center rounded-lg border px-2 text-[10px] font-bold transition-colors shadow-2xs whitespace-nowrap active:scale-95 ${
                              isAtStockLimit
                                ? "border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-60"
                                : "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 hover:border-emerald-400 cursor-pointer"
                            }`}
                            title={
                              isAtStockLimit
                                ? `Stock limit reached (${availableStock} in lot)`
                                : currQty < multiplier
                                  ? `Set to 1 full carton (${multiplier} ${pluralizeUnit(item.baseUnit, multiplier)})`
                                  : `Add 1 carton (+${multiplier} ${pluralizeUnit(item.baseUnit, multiplier)})`
                            }
                          >
                            +1 Ctn
                          </button>
                        )}
                      </div>
                    </div>

                    {hasCartons && (
                      <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50/90 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200/80 dark:border-emerald-800 font-mono">
                        <span>
                          {ctns > 0 ? (
                            loose > 0
                              ? `${ctns} ${pluralizeUnit("Carton", ctns)} + ${loose} ${pluralizeUnit(item.baseUnit, loose)}`
                              : `${ctns} ${pluralizeUnit("Carton", ctns)} (${item.quantity} ${pluralizeUnit(item.baseUnit, item.quantity)})`
                          ) : (
                            `${loose} ${pluralizeUnit(item.baseUnit, loose)} (Loose)`
                          )}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between md:block md:text-right">
                    <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 md:hidden">
                      Unit price
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                      {formatTk(item.unitPrice)}
                    </span>
                    {hasCartons && (
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono" title="Rate per carton">
                        ({formatTk(item.unitPrice * multiplier)}/ctn)
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between md:block md:text-right">
                    <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 md:hidden">
                      Line total
                    </span>
                    <span className="font-mono text-sm font-black text-slate-950 dark:text-slate-100 tabular-nums">
                      {formatTk(lineTotal)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 md:static cursor-pointer"
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

      {/* Held Orders Modal */}
      <Modal
        isOpen={isParkedModalOpen}
        onClose={() => setIsParkedModalOpen(false)}
        title="Held Orders (Parked Tickets)"
        subtitle={`Select a held ticket to resume counter checkout (${parkedCarts.length}/${MAX_PARKED_CARTS} slots used)`}
        icon={<Clock className="h-5 w-5 text-amber-500" />}
        size="md"
        headerVariant="dark"
      >
        <div className="p-4 sm:p-5">
          {parkedCarts.length === 0 ? (
            <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-sm">
              No orders currently on hold.
            </div>
          ) : (
            <div className="space-y-3">
              {parkedCarts.map((p, idx) => (
                <div
                  key={p.id}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-4 transition-all hover:border-slate-300 dark:hover:border-slate-700"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                          {p.customerName || "Walk-in Customer"}
                        </span>
                        <Badge variant="warning" className="text-[10px] px-1.5 py-0">
                          Ticket #{idx + 1}
                        </Badge>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          {formatParkedAge(p.parkedAt)}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                        <span className="font-mono font-bold">{p.itemCount}</span> items •{" "}
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          {formatTk(p.totalAmount)}
                        </span>
                      </div>
                      {/* Item Preview */}
                      <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-sm">
                        {p.state.cart
                          .map((ci) => `${ci.nameEn || ci.nameBn} (${ci.quantity})`)
                          .join(", ")}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleRecallOrder(p)}
                        leftIcon={<PlayCircle className="h-4 w-4" />}
                        className="h-8 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-2xs"
                      >
                        Resume
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteParkedCart(p.id)}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                        title="Discard held order"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </section>
  )
}
