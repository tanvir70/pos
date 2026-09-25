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
        className="fixed z-50 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-1.5 animate-in fade-in zoom-in-95 duration-100 text-left overflow-hidden"
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
        <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-emerald-700" />
            <span>Select Lot for Sticker</span>
          </span>
          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full">
            {dropdown.lots.length} Lots Available
          </span>
        </div>

        <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 no-scrollbar p-1">
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
                className="w-full text-left p-2.5 hover:bg-emerald-50/60 rounded-xl transition-all flex items-center justify-between group cursor-pointer"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 group-hover:border-emerald-300 group-hover:bg-emerald-100 group-hover:text-emerald-900 transition-colors">
                      {formatLotNumber(lot.lotNumber, idx)}
                    </span>
                    {lot.lotBarcode && (
                      <span className="text-[10px] font-mono text-slate-500">
                        #{lot.lotBarcode}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-600 flex items-center gap-2">
                    <span>
                      Stock: <strong className="text-emerald-800 font-mono font-bold">{lotQty}</strong>
                    </span>
                    <span>•</span>
                    <span className="text-slate-500">
                      Exp: {lot.expiryDate || "N/A"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 group-hover:bg-emerald-700 group-hover:text-white group-hover:border-emerald-700 transition-all shrink-0 ml-2">
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
