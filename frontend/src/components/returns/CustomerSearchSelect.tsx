import React, { useState, useEffect, useMemo, useRef } from "react"
import {
  Search,
  User,
  Phone,
  Building2,
  MapPin,
  Check,
  X,
  AlertTriangle,
  UserCheck,
  ChevronDown,
  RotateCcw,
  Sparkles,
} from "lucide-react"
import type { Customer, RefundType } from "../../types"
import { getCustomers } from "../../api/endpoints"

export interface CustomerSearchSelectProps {
  customers: Customer[]
  selectedCustomerId: number | null
  onSelectCustomerId: (id: number | null) => void
  refundType: RefundType
  calculatedTotalRefund?: number
  disabled?: boolean
}

const tk = (n: number | undefined | null) =>
  `৳${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function CustomerSearchSelect({
  customers,
  selectedCustomerId,
  onSelectCustomerId,
  refundType,
  calculatedTotalRefund = 0,
  disabled = false,
}: CustomerSearchSelectProps) {
  const [query, setQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isChanging, setIsChanging] = useState(false)

  // Remote search results for query
  const [remoteResults, setRemoteResults] = useState<Customer[]>([])
  const [isSearchingRemote, setIsSearchingRemote] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Find currently selected customer
  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null
    return customers.find((c) => c.id === selectedCustomerId) || null
  }, [customers, selectedCustomerId])

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        if (selectedCustomer) {
          setIsChanging(false)
        }
      }
    }
    document.addEventListener("mousedown", handleOutside)
    return () => document.removeEventListener("mousedown", handleOutside)
  }, [selectedCustomer])

  // Focus input when changing customer or opening
  useEffect(() => {
    if (isChanging || (!selectedCustomer && isOpen)) {
      inputRef.current?.focus()
    }
  }, [isChanging, isOpen, selectedCustomer])

  // Debounced server-side search if query is typed
  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed || trimmed.length < 2) {
      setRemoteResults([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearchingRemote(true)
        const res = await getCustomers(trimmed)
        setRemoteResults(res)
      } catch {
        setRemoteResults([])
      } finally {
        setIsSearchingRemote(false)
      }
    }, 150)

    return () => clearTimeout(timer)
  }, [query])

  // Combine and deduplicate client-side and remote-matched customers
  const filteredCustomers = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pool = [...customers]

    // Append remote results if not already present
    for (const r of remoteResults) {
      if (!pool.some((c) => c.id === r.id)) {
        pool.push(r)
      }
    }

    if (!q) {
      return pool.slice(0, 25)
    }

    return pool
      .filter((c) => {
        const matchName = (c.name || "").toLowerCase().includes(q)
        const matchPhone = (c.phone || "").toLowerCase().includes(q)
        const matchBusiness = (c.businessName || "").toLowerCase().includes(q)
        const matchProprietor = (c.proprietorName || "").toLowerCase().includes(q)
        const matchVillage = (c.villageAddress || c.address || "").toLowerCase().includes(q)
        return matchName || matchPhone || matchBusiness || matchProprietor || matchVillage
      })
      .slice(0, 25)
  }, [customers, remoteResults, query])

  const handleSelect = (customer: Customer | null) => {
    onSelectCustomerId(customer ? customer.id : null)
    setIsOpen(false)
    setIsChanging(false)
    setQuery("")
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Items include 1 walk-in entry + filteredCustomers
    const totalItems = 1 + filteredCustomers.length

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((prev) => Math.min(prev + 1, totalItems - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (activeIndex === 0) {
        handleSelect(null)
      } else if (filteredCustomers[activeIndex - 1]) {
        handleSelect(filteredCustomers[activeIndex - 1])
      }
    } else if (e.key === "Escape") {
      setIsOpen(false)
      setIsChanging(false)
    }
  }

  const isDueAdjustmentMissing = refundType === "DUE_ADJUSTMENT" && !selectedCustomerId

  // Calculate live due reduction if Due Adjustment is selected
  const dueAdjustmentMath = useMemo(() => {
    if (!selectedCustomer) return null
    const currentDue = Number(selectedCustomer.currentDue || 0)
    const refund = Number(calculatedTotalRefund || 0)
    if (refund <= 0) return null

    if (refund <= currentDue) {
      const remainingDue = currentDue - refund
      return {
        remainingDue,
        excessCash: 0,
        label: `Reduces debt to ${tk(remainingDue)}`,
      }
    } else {
      const excessCash = refund - currentDue
      return {
        remainingDue: 0,
        excessCash,
        label: `Clears all debt + ${tk(excessCash)} cash payout`,
      }
    }
  }, [selectedCustomer, calculatedTotalRefund])

  return (
    <div ref={containerRef} className="space-y-1.5">
      {/* Label and Quick Actions */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
          <span>Customer Account</span>
          {refundType === "DUE_ADJUSTMENT" ? (
            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-1.5 py-0.2 rounded">
              * Required for Due Refund
            </span>
          ) : (
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">
              (Optional for Cash)
            </span>
          )}
        </label>

        {selectedCustomer && !isChanging ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsChanging(true)}
              className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 px-2 py-0.5 rounded cursor-pointer transition-colors"
            >
              Change
            </button>
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-2 py-0.5 rounded cursor-pointer transition-colors"
            >
              Walk-in
            </button>
          </div>
        ) : (
          !selectedCustomer && (
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors"
            >
              Walk-in Active
            </button>
          )
        )}
      </div>

      {/* Mode 1: Selected Customer Card Display */}
      {selectedCustomer && !isChanging ? (
        <div className="p-3 bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-2 shadow-2xs">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 flex items-center justify-center shrink-0 font-bold text-xs">
                {selectedCustomer.name ? selectedCustomer.name.charAt(0).toUpperCase() : <UserCheck className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm truncate">
                  {selectedCustomer.name}
                  {selectedCustomer.businessName && (
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 ml-1.5 font-normal">
                      ({selectedCustomer.businessName})
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="font-mono text-slate-700 dark:text-slate-300">{selectedCustomer.phone}</span>
                  {selectedCustomer.villageAddress && (
                    <>
                      <span>·</span>
                      <span className="truncate max-w-[120px]">{selectedCustomer.villageAddress}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[9px] text-slate-400 dark:text-slate-500 block uppercase font-bold tracking-wider">Ledger Debt</span>
              {Number(selectedCustomer.currentDue || 0) > 0 ? (
                <span className="inline-block px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                  {tk(selectedCustomer.currentDue)}
                </span>
              ) : (
                <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Settled (৳0.00)
                </span>
              )}
            </div>
          </div>

          {/* Contextual Due Impact Strip */}
          <div className="pt-1.5 border-t border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between text-[11px]">
            {refundType === "DUE_ADJUSTMENT" ? (
              dueAdjustmentMath ? (
                <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>{dueAdjustmentMath.label}</span>
                </span>
              ) : (
                <span className="text-amber-800 dark:text-amber-300 font-medium">
                  Refund will credit against this customer's due balance
                </span>
              )
            ) : (
              <span className="text-slate-500 dark:text-slate-400">
                Cash payout · Customer ledger balance will not change
              </span>
            )}

            <button
              type="button"
              onClick={() => setIsChanging(true)}
              className="text-[10px] font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 underline cursor-pointer"
            >
              Switch Account
            </button>
          </div>
        </div>
      ) : (
        /* Mode 2: Searchable Customer Omnibar & Live Dropdown */
        <div className="relative">
          <div className="relative flex items-center">
            <div className="absolute left-3 text-slate-400 pointer-events-none flex items-center">
              <Search className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            </div>

            <input
              ref={inputRef}
              type="text"
              disabled={disabled}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setIsOpen(true)
                setActiveIndex(0)
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder="Search customer by name, phone (01...), village..."
              className={`w-full pl-9 pr-18 py-2.5 bg-slate-50/60 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-850 border rounded-xl text-xs sm:text-sm font-medium transition-all shadow-2xs focus:outline-hidden text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 ${
                isDueAdjustmentMissing
                  ? "border-rose-400 dark:border-rose-600 bg-rose-50/30 dark:bg-rose-950/30 focus:border-rose-500"
                  : "border-slate-200 dark:border-slate-700 focus:border-emerald-600 dark:focus:border-emerald-500"
              }`}
            />

            <div className="absolute right-2 flex items-center gap-1">
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("")
                    inputRef.current?.focus()
                  }}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              {isChanging && (
                <button
                  type="button"
                  onClick={() => setIsChanging(false)}
                  className="px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 bg-slate-100 dark:bg-slate-700 rounded-md cursor-pointer transition-colors"
                >
                  Cancel
                </button>
              )}
              {!isChanging && (
                <button
                  type="button"
                  onClick={() => setIsOpen(!isOpen)}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md cursor-pointer transition-colors"
                  title={isOpen ? "Close list" : "Browse all customers"}
                >
                  <ChevronDown className={`w-4 h-4 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`} />
                </button>
              )}
            </div>
          </div>

          {/* Autocomplete Dropdown */}
          {isOpen && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in duration-100 max-h-72 overflow-y-auto">
              {/* Option 0: Walk-in Retail Customer */}
              <div
                onClick={() => handleSelect(null)}
                className={`p-2.5 text-xs transition-colors cursor-pointer flex items-center justify-between ${
                  activeIndex === 0 ? "bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 font-semibold" : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold block text-slate-900 dark:text-slate-100">Walk-in / Cash Buyer (No Ledger Profile)</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">Immediate cash return · No account debt adjustment</span>
                  </div>
                </div>
                {!selectedCustomerId && (
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full shrink-0">
                    Active
                  </span>
                )}
              </div>

              {/* Customer matches */}
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((c, idx) => {
                  const itemIndex = idx + 1
                  const isHighlighted = activeIndex === itemIndex
                  const isCurrent = selectedCustomerId === c.id

                  return (
                    <div
                      key={c.id}
                      onClick={() => handleSelect(c)}
                      className={`p-2.5 text-xs transition-colors cursor-pointer flex items-center justify-between ${
                        isHighlighted ? "bg-emerald-50/90 dark:bg-emerald-950/40" : "hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 dark:text-slate-100">{c.name}</span>
                          {c.businessName && (
                            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              ({c.businessName})
                            </span>
                          )}
                          {isCurrent && (
                            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                              <Check className="w-2.5 h-2.5" />
                              <span>Selected</span>
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="font-mono text-slate-700 dark:text-slate-300">{c.phone}</span>
                          {c.villageAddress && (
                            <>
                              <span>·</span>
                              <span>{c.villageAddress}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {Number(c.currentDue || 0) > 0 ? (
                          <span className="font-mono font-bold text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-md text-[11px]">
                            Due: {tk(c.currentDue)}
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                            Settled
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">
                  <p>No registered customer matches "{query}".</p>
                  <button
                    type="button"
                    onClick={() => handleSelect(null)}
                    className="mt-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 underline cursor-pointer"
                  >
                    Select Walk-in Buyer
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isDueAdjustmentMissing && (
        <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-1 flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>Due adjustment requires a customer ledger profile to deduct from.</span>
        </p>
      )}
    </div>
  )
}
