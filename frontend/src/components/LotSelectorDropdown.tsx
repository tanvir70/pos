import { useState, useRef, useEffect } from "react"
import type { InventoryLot } from "../types"
import { ChevronUp, ChevronDown, Check } from "lucide-react"

// BUSINESS DECISION: Default to FEFO (earliest expiry date) lot. Cashier can manually override
// to any active lot from dropdown to match the physical chemical batch handed to the customer.
// Purchase cost is masked (***) unless Owner Mode is active to prevent cost leaking during bargaining.

export interface LotSelectorDropdownProps {
  lots: InventoryLot[]
  selectedLotId: number
  onSelectLot: (lot: InventoryLot) => void
  isOwner?: boolean
}

export default function LotSelectorDropdown({
  lots,
  selectedLotId,
  onSelectLot,
  isOwner = false,
}: LotSelectorDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Determine FEFO lot (earliest expiry date)
  const fefoLot = lots.length > 0
    ? [...lots].sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())[0]
    : null

  const selectedLot = lots.find((l) => l.id === selectedLotId) || fefoLot || lots[0]

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  if (!lots || lots.length === 0) {
    return (
      <span className="text-xs text-slate-500 italic">
        No lot information available
      </span>
    )
  }

  // If only 1 lot exists, display simple badge without dropdown toggle
  if (lots.length === 1) {
    const lot = lots[0]
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs">
        <span className="font-mono font-semibold text-slate-900">
          #{lot.lotNumber}
        </span>
        <span className="text-slate-500 text-[11px]">
          (Expiry: {lot.expiryDate})
        </span>
        <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
          FEFO Suggested
        </span>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`inline-flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
          isOpen
            ? "border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-50/50"
            : "border-slate-200 bg-white hover:bg-slate-50 text-slate-900"
        }`}
        title="Click to select a different lot"
      >
        <div className="flex items-center gap-1.5">
          <span className="font-mono font-bold text-slate-900">
            #{selectedLot.lotNumber}
          </span>
          <span className="text-[11px] text-slate-500">
            (Expiry: {selectedLot.expiryDate})
          </span>
          {fefoLot && selectedLot.id === fefoLot.id && (
            <span className="px-1 py-0.2 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
              FEFO
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-72 sm:w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-200/60">
          <div className="px-3 py-2 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900">
              Select a Lot ({lots.length} active)
            </span>
            <span className="text-[11px] text-emerald-700 font-semibold">
              FEFO Active
            </span>
          </div>

          <div className="max-h-60 overflow-y-auto divide-y divide-slate-200/40">
            {lots.map((lot) => {
              const isSelected = lot.id === selectedLot.id
              const isFefo = fefoLot?.id === lot.id
              return (
                <button
                  key={lot.id}
                  type="button"
                  onClick={() => {
                    onSelectLot(lot)
                    setIsOpen(false)
                  }}
                  className={`w-full text-left p-2.5 transition-colors cursor-pointer flex flex-col gap-1 ${
                    isSelected
                      ? "bg-emerald-50/80 border-l-4 border-l-emerald-600"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-xs text-slate-900">
                        #{lot.lotNumber}
                      </span>
                      {isFefo && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          FEFO Suggested
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <span className="text-emerald-700 text-xs font-bold flex items-center gap-0.5">
                        <Check className="w-3 h-3" />
                        <span>Selected</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Expiry: <span className="font-medium text-slate-900">{lot.expiryDate}</span>
                    </span>
                    <span className="tabular-nums">
                      Retail: ৳{lot.lotRetailPrice} | Wholesale: ৳{lot.lotWholesalePrice}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500/80 flex items-center justify-between border-t border-slate-200/30 pt-1 mt-0.5">
                    <span>
                      Barcode: <span className="font-mono">{lot.barcode || "N/A"}</span>
                    </span>
                    <span className={isOwner ? "text-emerald-800 font-semibold" : "text-slate-500"}>
                      {isOwner ? `Cost: ৳${lot.purchaseCost}` : "Cost: ৳***"}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
