import React from "react"
import { Package, Layers, AlertTriangle, Hourglass } from "lucide-react"
import GotposStatCard from "../dashboard/GotposStatCard"
import { formatTk } from "../../utils/currency"

export interface InventoryStatCardsProps {
  productsCount: number
  totalStockUnits: number
  lowStockCount: number
  expiringLotsCount: number
  totalValuation: number
  totalRetailValuation: number
  activeFilter: string
  onFilterClick: (filter: string) => void
}

export default function InventoryStatCards({
  productsCount,
  totalStockUnits,
  lowStockCount,
  expiringLotsCount,
  totalValuation,
  totalRetailValuation,
  activeFilter,
  onFilterClick,
}: InventoryStatCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {/* 1. Registered Products */}
      <GotposStatCard
        title="Registered SKUs"
        value={productsCount}
        subtitle="Active catalog items"
        theme="emerald"
        icon={<Package className="w-5 h-5" />}
      />

      {/* 2. Total Dokan Stock */}
      <GotposStatCard
        title="Total Dokan Stock"
        value={`${totalStockUnits.toLocaleString("en-US")} units`}
        subtitle="Available across all lots"
        theme="navy"
        icon={<Layers className="w-5 h-5" />}
      />

      {/* 3. Low Stock Alert (Click to filter table) */}
      <GotposStatCard
        title="Low Stock Alert"
        value={lowStockCount}
        valueColor={lowStockCount > 0 ? "text-amber-700" : "text-slate-900"}
        subtitle={
          lowStockCount > 0 ? (
            <span className="text-amber-700 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              {lowStockCount} below threshold • {activeFilter === "LOW_STOCK" ? "Filter active (click to reset)" : "Click to filter"}
            </span>
          ) : (
            <span className="text-emerald-600 font-medium">All stock levels healthy</span>
          )
        }
        theme={lowStockCount > 0 ? "amber" : "emerald"}
        icon={<AlertTriangle className="w-5 h-5" />}
        onClick={() => onFilterClick("LOW_STOCK")}
        className={`cursor-pointer hover:border-amber-300 shadow-xs transition-all ${
          activeFilter === "LOW_STOCK" ? "ring-2 ring-amber-500 border-amber-400 bg-amber-50/20" : ""
        }`}
      />

      {/* 4. Lots at Risk of Expiring (< 30 days) (Click to filter table) */}
      <GotposStatCard
        title="Expiring Lots (< 30d)"
        value={expiringLotsCount}
        valueColor={expiringLotsCount > 0 ? "text-rose-600" : "text-slate-900"}
        subtitle={
          expiringLotsCount > 0 ? (
            <span className="text-rose-600 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              {expiringLotsCount} at risk (&lt; 30d) • {activeFilter === "EXPIRING" ? "Filter active (click to reset)" : "Click to filter"}
            </span>
          ) : (
            <span className="text-emerald-600 font-medium">All shelf lives safe</span>
          )
        }
        theme={expiringLotsCount > 0 ? "rose" : "emerald"}
        icon={<Hourglass className="w-5 h-5" />}
        onClick={() => onFilterClick("EXPIRING")}
        className={`cursor-pointer hover:border-rose-300 shadow-xs transition-all ${
          activeFilter === "EXPIRING" ? "ring-2 ring-rose-500 border-rose-400 bg-rose-50/20" : ""
        }`}
      />

      {/* 5. Inventory Valuation */}
      <GotposStatCard
        title="Inventory Valuation"
        value={formatTk(totalValuation)}
        subtitle={
          <span className="text-slate-500 flex items-center justify-between gap-1 w-full">
            <span>Cost value</span>
            <span className="text-emerald-700 font-bold">Retail: {formatTk(totalRetailValuation)}</span>
          </span>
        }
        theme="orange"
        icon={<span className="text-xl font-bold">৳</span>}
      />
    </div>
  )
}
