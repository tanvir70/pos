import { useState, useRef, useEffect } from "react"
import type { InventoryLot } from "../types"

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
      <span className="text-xs text-frost-muted italic bn-text">
        লট তথ্য পাওয়া যায়নি
      </span>
    )
  }

  // If only 1 lot exists, display simple badge without dropdown toggle
  if (lots.length === 1) {
    const lot = lots[0]
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-frost-surface border border-frost-border rounded-lg text-xs">
        <span className="font-mono font-semibold text-frost-dark">
          #{lot.lotNumber}
        </span>
        <span className="text-frost-muted text-[11px]">
          (মেয়াদ: {lot.expiryDate})
        </span>
        <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 bn-text">
          FEFO প্রস্তাবিত
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
            : "border-frost-border bg-white hover:bg-frost-surface text-frost-dark"
        }`}
        title="ক্লিক করে অন্য লট নির্বাচন করুন"
      >
        <div className="flex items-center gap-1.5">
          <span className="font-mono font-bold text-frost-dark">
            #{selectedLot.lotNumber}
          </span>
          <span className="text-[11px] text-frost-muted">
            (মেয়াদ: {selectedLot.expiryDate})
          </span>
          {fefoLot && selectedLot.id === fefoLot.id && (
            <span className="px-1 py-0.2 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 bn-text">
              FEFO
            </span>
          )}
        </div>
        <span className="text-[10px] text-frost-muted">
          {isOpen ? "▲" : "▼"}
        </span>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-72 sm:w-80 bg-white border border-frost-border rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-frost-border/60">
          <div className="px-3 py-2 bg-frost-surface flex items-center justify-between">
            <span className="text-xs font-bold text-frost-dark bn-text">
              লট নির্বাচন করুন ({lots.length}টি লট সক্রিয়)
            </span>
            <span className="text-[11px] text-emerald-700 font-semibold bn-text">
              FEFO সক্রিয়
            </span>
          </div>

          <div className="max-h-60 overflow-y-auto divide-y divide-frost-border/40">
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
                      : "hover:bg-frost-surface"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-xs text-frost-dark">
                        #{lot.lotNumber}
                      </span>
                      {isFefo && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 bn-text border border-emerald-300">
                          FEFO প্রস্তাবিত
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <span className="text-emerald-700 text-xs font-bold">
                        ✓ নির্বাচিত
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-frost-muted">
                    <span>
                      মেয়াদ: <span className="font-medium text-frost-dark">{lot.expiryDate}</span>
                    </span>
                    <span className="tabular-nums">
                      খুচরা: ৳{lot.lotRetailPrice} | পাইকারি: ৳{lot.lotWholesalePrice}
                    </span>
                  </div>

                  <div className="text-[11px] text-frost-muted/80 flex items-center justify-between border-t border-frost-border/30 pt-1 mt-0.5">
                    <span>
                      বারকোড: <span className="font-mono">{lot.barcode || "N/A"}</span>
                    </span>
                    <span className={isOwner ? "text-emerald-800 font-semibold" : "text-frost-muted"}>
                      {isOwner ? `কেনা: ৳${lot.purchaseCost}` : "কেনা: ৳***"}
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
