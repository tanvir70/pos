import React from "react"
import { Tag } from "lucide-react"
import type { StockItem } from "../../types"
import { formatLotNumber } from "../../utils/lotNumber"

export interface LotDropdownProduct {
  productId: number
  rect: { top: number; right: number; bottom: number }
  lots: StockItem[]
}

export interface ProductLotsPopoverProps {
  dropdown: LotDropdownProduct | null
  onClose: () => void
  onSelectLot: (lot: StockItem, lots: StockItem[]) => void
}

export default function ProductLotsPopover({
  dropdown,
  onClose,
  onSelectLot,
}: ProductLotsPopoverProps) {
  if (!dropdown) return null

  return (
    <>
      {/* Transparent backdrop to close dropdown on outside click */}
      <div
        className="fixed inset-0 z-40 bg-transparent"
        onClick={onClose}
      />
      {/* Floating dropdown menu */}
      <div
        className="fixed z-50 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800 py-1.5 animate-in fade-in zoom-in-95 duration-100 text-left overflow-hidden"
        style={{
          top:
            dropdown.rect.top + 280 > window.innerHeight
              ? undefined
              : `${dropdown.rect.top}px`,
          bottom:
            dropdown.rect.top + 280 > window.innerHeight
              ? `${window.innerHeight - dropdown.rect.bottom}px`
              : undefined,
          right: `${Math.max(16, dropdown.rect.right)}px`,
        }}
      >
        <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
            <span>Select Lot for Sticker</span>
          </span>
          <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/70 px-2 py-0.5 rounded-full">
            {dropdown.lots.length} Lots Available
          </span>
        </div>

        <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 no-scrollbar p-1">
          {dropdown.lots.map((lot, idx) => {
            const lotQty = Number(lot.quantity ?? (lot as any).totalQuantity ?? 0)
            return (
              <button
                key={lot.lotId}
                type="button"
                onClick={() => {
                  onSelectLot(lot, dropdown.lots)
                  onClose()
                }}
                className="w-full text-left p-2.5 hover:bg-emerald-50/60 dark:hover:bg-slate-800/70 rounded-xl transition-all flex items-center justify-between group cursor-pointer"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 group-hover:border-emerald-300 dark:group-hover:border-emerald-700 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-950 group-hover:text-emerald-900 dark:group-hover:text-emerald-300 transition-colors">
                      {formatLotNumber(lot.lotNumber, idx)}
                    </span>
                    {lot.lotBarcode && (
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        #{lot.lotBarcode}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-2">
                    <span>
                      Stock: <strong className="text-emerald-800 dark:text-emerald-400 font-mono font-bold">{lotQty}</strong>
                    </span>
                    <span>•</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      Exp: {lot.expiryDate || "N/A"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 group-hover:bg-emerald-700 dark:group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-700 dark:group-hover:border-emerald-600 transition-all shrink-0 ml-2">
                  <span>Print</span>
                  <Tag className="w-3 h-3" />
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
