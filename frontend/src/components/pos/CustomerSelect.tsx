import { useState, useRef, useEffect, useMemo } from "react"
import { User, ShoppingCart, X, ChevronDown, Plus } from "lucide-react"
import type { Customer } from "../../types"
import { formatTk } from "../../utils/currency"
import Badge from "../ui/Badge"

export interface CustomerSelectProps {
  customers: Customer[]
  selectedCustomerId: number | null
  onSelectCustomer: (id: number | null) => void
  onAddNewCustomer?: () => void
}

export default function CustomerSelect({
  customers,
  selectedCustomerId,
  onSelectCustomer,
  onAddNewCustomer,
}: CustomerSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState("")
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) || null
  }, [customers, selectedCustomerId])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
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

  // Auto focus input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setSearch("")
      setTimeout(() => searchInputRef.current?.focus(), 40)
    }
  }, [isOpen])

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers.slice(0, 10)
    return customers
      .filter((c) => {
        const name = (c.name || "").toLowerCase()
        const phone = (c.phone || "").toLowerCase()
        const prop = (c.proprietorName || "").toLowerCase()
        return name.includes(q) || phone.includes(q) || prop.includes(q)
      })
      .slice(0, 10)
  }, [customers, search])

  return (
    <div ref={dropdownRef} className="relative w-full">
      {/* Active Customer Display Card */}
      {selectedCustomer ? (
        <div className="flex items-center justify-between p-2.5 bg-emerald-50/70 border border-emerald-300/80 rounded-xl shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-xs text-slate-900 truncate">
                  {selectedCustomer.name}
                </span>
                <Badge
                  variant={selectedCustomer.customerType === "WHOLESALE" ? "purple" : "info"}
                  size="sm"
                >
                  {selectedCustomer.customerType === "WHOLESALE" ? "Wholesale" : "Retail"}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                <span className="font-mono">{selectedCustomer.phone}</span>
                {selectedCustomer.currentDue > 0 && (
                  <span className="font-bold text-red-600 font-mono">
                    Due: {formatTk(selectedCustomer.currentDue)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="px-2 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 rounded-md cursor-pointer"
            >
              Change
            </button>
            <button
              type="button"
              onClick={() => onSelectCustomer(null)}
              className="p-1 text-slate-500 hover:text-red-600 rounded-md cursor-pointer text-xs"
              title="Set as walk-in customer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="w-full flex items-center justify-between p-2.5 bg-slate-50/40 hover:bg-slate-50 border border-slate-200 rounded-xl text-left transition-all cursor-pointer shadow-xs"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-xs text-slate-900 truncate">
                Walk-in Customer
              </p>
              <p className="text-[11px] text-slate-500">
                Click to select a regular or due customer
              </p>
            </div>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        </button>
      )}

      {/* Autocomplete Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in duration-150 max-h-80 flex flex-col">
          {/* Search Header */}
          <div className="p-2.5 border-b border-slate-200/60 bg-slate-50/30">
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by customer name or phone number..."
              className="w-full text-xs py-1.5 px-3 bg-white border border-slate-200 rounded-lg focus:border-emerald-600 focus:outline-hidden"
            />
          </div>

          {/* Quick Select Walk-in Option */}
          <div className="p-1.5 border-b border-slate-200/40">
            <button
              type="button"
              onClick={() => {
                onSelectCustomer(null)
                setIsOpen(false)
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg hover:bg-slate-100 cursor-pointer text-left transition-colors"
            >
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-slate-500" />
                <span className="font-bold text-slate-900">
                  Walk-in Customer (Cash Sale)
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Walk-in</span>
            </button>
          </div>

          {/* Customer Items List */}
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
            {filteredCustomers.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                No customers found.
              </div>
            ) : (
              filteredCustomers.map((c) => {
                const isSelected = c.id === selectedCustomerId
                const hasDue = c.currentDue > 0

                return (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => {
                      onSelectCustomer(c.id)
                      setIsOpen(false)
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg cursor-pointer text-left transition-colors ${
                      isSelected
                        ? "bg-emerald-100 text-emerald-900 font-bold"
                        : "hover:bg-slate-100 text-slate-900"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold truncate">{c.name}</span>
                        <span className="text-[10px] font-mono text-slate-500">
                          ({c.phone})
                        </span>
                      </div>
                      {c.address && (
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">
                          {c.address}
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      {hasDue ? (
                        <span className="text-[11px] font-bold text-red-600 font-mono">
                          Due {formatTk(c.currentDue)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-700 font-semibold">
                          Settled
                        </span>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Footer Action */}
          {onAddNewCustomer && (
            <div className="p-2 border-t border-slate-200/60 bg-slate-50/40 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false)
                  onAddNewCustomer()
                }}
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-900 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add New Customer
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
