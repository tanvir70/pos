import React, { Fragment, useMemo } from "react"
import {
  Search,
  AlertTriangle,
  Hourglass,
  X,
  Package,
  Layers,
  ChevronUp,
  ChevronDown,
  Plus,
  History,
  ShieldAlert,
  Tag,
  Edit,
} from "lucide-react"
import type { Product, StockItem, GroupedProduct } from "../../types"
import { formatTk } from "../../utils/currency"
import { formatLotNumber } from "../../utils/lotNumber"
import { getEffectiveMultiplier, pluralizeUnit, formatQuantity } from "../../utils/unit"
import { focusSidebarMenu, focusFirstTableRow, focusPrimarySearch } from "../../utils/keyboard"
import Button from "../ui/Button"
import Input from "../ui/Input"
import Pagination from "../ui/Pagination"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmptyState,
  TableLoadingState,
} from "../ui/Table"

export interface InventoryTableProps {
  products: Product[]
  groupedProducts: GroupedProduct[]
  filteredProducts: GroupedProduct[]
  categories: string[]
  isLoading: boolean
  search: string
  onSearchChange: (val: string) => void
  activeFilter: string
  onFilterClick: (filter: string) => void
  lowStockCount: number
  expiringLotsCount: number
  stockPage: number
  stockPageSize: number
  onPageChange: (p: number) => void
  onPageSizeChange: (s: number) => void
  expandedProductIds: Set<number>
  toggleLotsExpanded: (productId: number) => void
  openAddStockModal: (item: GroupedProduct) => void
  onOpenEditProduct?: (item: GroupedProduct) => void
  onOpenLedger: (item: GroupedProduct, lot?: StockItem) => void
  onOpenAdjustment: (productId: number, lotId?: number) => void
  onOpenSticker: (item: StockItem, lots: StockItem[]) => void
  onOpenLotsDropdown: (productId: number, lots: StockItem[], buttonRect: DOMRect) => void
  lotDropdownProductId?: number
}

export default function InventoryTable({
  products,
  groupedProducts,
  filteredProducts,
  categories,
  isLoading,
  search,
  onSearchChange,
  activeFilter,
  onFilterClick,
  lowStockCount,
  expiringLotsCount,
  stockPage,
  stockPageSize,
  onPageChange,
  onPageSizeChange,
  expandedProductIds,
  toggleLotsExpanded,
  openAddStockModal,
  onOpenEditProduct,
  onOpenLedger,
  onOpenAdjustment,
  onOpenSticker,
  onOpenLotsDropdown,
  lotDropdownProductId,
}: InventoryTableProps) {
  const paginatedProducts = useMemo(() => {
    const start = stockPage * stockPageSize
    return filteredProducts.slice(start, start + stockPageSize)
  }, [filteredProducts, stockPage, stockPageSize])

  return (
    <div className="space-y-4">
      {/* Search & Category Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex-1 max-w-md">
          <Input
            data-primary-search="true"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault()
                focusFirstTableRow()
              } else if (
                e.key === "ArrowLeft" &&
                e.currentTarget.selectionStart === 0 &&
                e.currentTarget.selectionEnd === 0
              ) {
                e.preventDefault()
                focusSidebarMenu()
              }
            }}
            onClear={() => onSearchChange("")}
            placeholder="Search by product name or code..."
            leftAdornment={<Search className="w-4 h-4 text-slate-400 dark:text-slate-500" />}
            inputSize="sm"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {/* 1. All */}
          <button
            type="button"
            onClick={() => onFilterClick("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              activeFilter === "ALL"
                ? "bg-slate-900 dark:bg-emerald-600 text-white shadow-xs"
                : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
            }`}
          >
            All ({products.length})
          </button>

          {/* 2. Categories */}
          {categories.map((cat) => (
            <button
              type="button"
              key={cat}
              onClick={() => onFilterClick(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap transition-all ${
                activeFilter === cat
                  ? "bg-emerald-700 dark:bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-800 dark:ring-emerald-500"
                  : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
              }`}
            >
              {cat}
            </button>
          ))}

          {/* 3. Low Stock */}
          <button
            type="button"
            onClick={() => onFilterClick("LOW_STOCK")}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap border flex items-center gap-1.5 transition-all ${
              activeFilter === "LOW_STOCK"
                ? "bg-amber-600 text-white border-amber-700 shadow-xs ring-1 ring-amber-700"
                : lowStockCount > 0
                ? "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/60"
                : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${activeFilter === "LOW_STOCK" ? "text-white" : "text-amber-600 dark:text-amber-400"}`} />
            <span>Low Stock</span>
            {lowStockCount > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  activeFilter === "LOW_STOCK"
                    ? "bg-amber-800 text-white"
                    : "bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100"
                }`}
              >
                {lowStockCount}
              </span>
            )}
          </button>

          {/* 4. Expiring Lots (< 30d) */}
          <button
            type="button"
            onClick={() => onFilterClick("EXPIRING")}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap border flex items-center gap-1.5 transition-all ${
              activeFilter === "EXPIRING"
                ? "bg-rose-600 text-white border-rose-700 shadow-xs ring-1 ring-rose-700"
                : expiringLotsCount > 0
                ? "bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/60"
                : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
          >
            <Hourglass className={`w-3.5 h-3.5 ${activeFilter === "EXPIRING" ? "text-white" : "text-rose-600 dark:text-rose-400"}`} />
            <span>Expiring (&lt; 30d)</span>
            {expiringLotsCount > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  activeFilter === "EXPIRING"
                    ? "bg-rose-800 text-white"
                    : "bg-rose-200 dark:bg-rose-800 text-rose-900 dark:text-rose-100"
                }`}
              >
                {expiringLotsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Active Filter Status Banner */}
      {activeFilter !== "ALL" && (
        <div className="flex items-center justify-between px-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-300 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500 dark:text-slate-400">Filtered by:</span>
            <span className="px-2 py-0.5 rounded-md font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs">
              {activeFilter === "LOW_STOCK"
                ? "Low Stock Alert"
                : activeFilter === "EXPIRING"
                ? "Expiring Lots (< 30 Days)"
                : activeFilter}
            </span>
            <span className="text-slate-500 dark:text-slate-400 font-medium">
              ({filteredProducts.length} {filteredProducts.length === 1 ? "product found" : "products found"})
            </span>
          </div>
          <button
            type="button"
            onClick={() => onFilterClick("ALL")}
            className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer hover:underline"
          >
            <X className="w-3.5 h-3.5" />
            <span>Reset to All</span>
          </button>
        </div>
      )}

      {/* Dokan Stock Inventory Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product &amp; Code</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Packaging Unit</TableHead>
              <TableHead align="center">Dokan Stock</TableHead>
              <TableHead align="right">Retail Price</TableHead>
              <TableHead align="right">Buying Price</TableHead>
              <TableHead align="right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableLoadingState colSpan={7} text="Loading stock list..." />
            ) : filteredProducts.length === 0 ? (
              <TableEmptyState
                colSpan={7}
                icon={<Package className="w-8 h-8" />}
                message={search.trim() ? "No matching in-stock products" : "No products found"}
                submessage={
                  search.trim()
                    ? "Check the spelling, or note that out-of-stock items (0 quantity) are hidden from search."
                    : "Reset the filters or add a new product"
                }
              />
            ) : (
              paginatedProducts.map((item) => {
                const isLowStock = item.totalStock <= item.minStockAlert
                const isExpanded = expandedProductIds.has(item.productId)
                const activeLots = item.lots.filter(
                  (lot: StockItem) => Number(lot.quantity ?? (lot as any).totalQuantity ?? 0) > 0,
                )

                return (
                  <Fragment key={item.productId}>
                    <TableRow
                      tabIndex={0}
                      data-nav-row="true"
                      onKeyDown={(e) => {
                        const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-nav-row="true"]'))
                        const currentIndex = rows.indexOf(e.currentTarget)
                        if (e.key === "ArrowDown" && currentIndex < rows.length - 1) {
                          e.preventDefault()
                          rows[currentIndex + 1]?.focus()
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault()
                          if (currentIndex > 0) {
                            rows[currentIndex - 1]?.focus()
                          } else {
                            focusPrimarySearch()
                          }
                        } else if (e.key === "ArrowLeft") {
                          e.preventDefault()
                          focusSidebarMenu()
                        } else if (e.key === "Enter" || e.key === " ") {
                          if (activeLots.length > 1) {
                            e.preventDefault()
                            toggleLotsExpanded(item.productId)
                          }
                        }
                      }}
                      className={`focus:outline-none focus:bg-emerald-50 dark:focus:bg-emerald-950/40 focus:ring-2 focus:ring-emerald-600 cursor-default ${
                        isLowStock ? "bg-amber-50/30 dark:bg-amber-950/20" : ""
                      }`}
                    >
                      {/* Product Info */}
                      <TableCell>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                            {item.nameEn}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                            <span className="font-mono text-emerald-800 dark:text-emerald-400 font-semibold">
                              #{item.productCode}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Category */}
                      <TableCell>
                        <span className="text-xs px-2 py-0.5 rounded-lg bg-slate-50 dark:bg-slate-800 font-semibold text-slate-900 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                          {item.category}
                        </span>
                      </TableCell>

                      {/* Packaging */}
                      <TableCell>
                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                          {item.baseUnit}
                        </span>
                      </TableCell>

                      {/* Dokan Stock */}
                      <TableCell align="center">
                        {item.totalStock <= 0 ? (
                          <div className="flex items-center justify-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              0 Out of Stock
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            {/* Row 1: Primary Stock Count + Batch Accordion Trigger */}
                            <div className="flex items-center justify-center gap-1.5">
                              {isLowStock ? (
                                <span
                                  className="inline-flex items-center gap-1.5 font-mono font-bold text-sm text-amber-900 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800"
                                  title={
                                    activeLots[0]
                                      ? `Lot: ${formatLotNumber(activeLots[0].lotNumber)} | Expiry: ${activeLots[0].expiryDate || "N/A"}`
                                      : undefined
                                  }
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                  {formatQuantity(item.totalStock, item.baseUnit)}
                                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-tight">
                                    Low
                                  </span>
                                </span>
                              ) : (
                                <span
                                  className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100 tabular-nums px-0.5"
                                  title={
                                    activeLots[0]
                                      ? `Lot: ${formatLotNumber(activeLots[0].lotNumber)} | Expiry: ${activeLots[0].expiryDate || "N/A"}`
                                      : undefined
                                  }
                                >
                                  {formatQuantity(item.totalStock, item.baseUnit)}
                                </span>
                              )}

                              {/* Smart Multi-Lot Tag: placed neatly next to the stock count */}
                              {activeLots.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => toggleLotsExpanded(item.productId)}
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border transition-all cursor-pointer ${
                                    isExpanded
                                      ? "bg-emerald-100 dark:bg-emerald-900/80 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 shadow-2xs"
                                      : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 hover:border-emerald-300"
                                  }`}
                                  title={
                                    isExpanded
                                      ? "Collapse lot batches"
                                      : `View ${activeLots.length} separate batches`
                                  }
                                >
                                  <Layers className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                                  <span>{activeLots.length} Lots</span>
                                  {isExpanded ? (
                                    <ChevronUp className="w-2.5 h-2.5" />
                                  ) : (
                                    <ChevronDown className="w-2.5 h-2.5" />
                                  )}
                                </button>
                              )}
                            </div>

                            {/* Row 2: Secondary Carton Breakdown as a subtle, clean subtitle */}
                            {(() => {
                              const mult = getEffectiveMultiplier(item.cartonMultiplier, item.packSize, item.unitSize)
                              if (mult <= 1 || item.totalStock <= 0) return null
                              const ctns = Math.floor(item.totalStock / mult)
                              const loose = item.totalStock % mult
                              if (ctns === 0 && loose === 0) return null
                              return (
                                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap leading-none mt-0.5">
                                  {ctns > 0 ? `${ctns} ctn` : ""}
                                  {ctns > 0 && loose > 0 ? " + " : ""}
                                  {loose > 0 ? `${formatQuantity(loose, item.baseUnit)} ${pluralizeUnit(item.baseUnit, loose).toLowerCase()}` : ""}
                                </span>
                              )
                            })()}
                          </div>
                        )}
                      </TableCell>

                      {/* Retail Price */}
                      <TableCell align="right" isMonospace className="font-bold text-slate-900 dark:text-slate-100">
                        {formatTk(item.retailPrice)}
                      </TableCell>

                      {/* Buying Price */}
                      <TableCell align="right" isMonospace>
                        <span className="text-amber-800 dark:text-amber-400 font-bold">
                          {formatTk(item.buyingPrice)}
                        </span>
                      </TableCell>

                      {/* Actions */}
                      <TableCell align="right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openAddStockModal(item)}
                            title="Add stock to this product"
                            leftIcon={<Plus className="w-3.5 h-3.5" />}
                            className="text-xs px-2 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60"
                          >
                            Stock
                          </Button>
                          {onOpenEditProduct && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onOpenEditProduct(item)}
                              title={`Edit product details and pricing for ${item.nameEn}`}
                              leftIcon={<Edit className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />}
                              className="text-xs px-2 py-1 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                            >
                              Edit
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenLedger(item)}
                            title={`View stock ledger for ${item.nameEn}`}
                            leftIcon={<History className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />}
                            className="text-xs px-2 py-1 border-slate-200 dark:border-slate-700 hover:bg-teal-50 dark:hover:bg-teal-950/60 text-slate-700 dark:text-slate-300 hover:text-teal-900 dark:hover:text-teal-300"
                          >
                            Stock Ledger
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenAdjustment(item.productId)}
                            title={`Record breakage, damage, or adjustment for ${item.nameEn}`}
                            leftIcon={<ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
                            className="text-xs px-2 py-1 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/60"
                          >
                            Adjust
                          </Button>
                          {activeLots.length > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                if (activeLots.length === 1) {
                                  onOpenSticker(activeLots[0], activeLots)
                                } else {
                                  const buttonRect = e.currentTarget.getBoundingClientRect()
                                  onOpenLotsDropdown(item.productId, activeLots, buttonRect)
                                }
                              }}
                              title={
                                activeLots.length > 1
                                  ? `Click to select lot (${activeLots.length} available)`
                                  : "Print barcode label sticker"
                              }
                              leftIcon={<Tag className="w-3.5 h-3.5" />}
                              rightIcon={
                                activeLots.length > 1 ? (
                                  <ChevronDown
                                    className={`w-3 h-3 transition-transform ${
                                      lotDropdownProductId === item.productId
                                        ? "rotate-180 text-emerald-700 dark:text-emerald-400"
                                        : "text-slate-400 dark:text-slate-500"
                                    }`}
                                  />
                                ) : undefined
                              }
                              className={`text-xs px-2 py-1 transition-all ${
                                lotDropdownProductId === item.productId
                                  ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 ring-1 ring-emerald-400 dark:ring-emerald-500"
                                  : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                              }`}
                            >
                              <span>Sticker</span>
                              {activeLots.length > 1 && (
                                <span className="text-[10px] px-1 py-0.2 bg-slate-100 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-300 font-bold ml-0.5">
                                  {activeLots.length}
                                </span>
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Expandable Active Lots Sub-Table */}
                    {isExpanded && activeLots.length > 0 && (
                      <TableRow className="bg-slate-50/60 dark:bg-slate-950/60 hover:bg-slate-50/60 dark:hover:bg-slate-950/60 border-t border-b border-slate-200 dark:border-slate-800">
                        <TableCell colSpan={7} className="p-3 sm:p-4">
                          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
                            {/* Header bar */}
                            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
                                  <Layers className="w-3.5 h-3.5" />
                                </span>
                                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                  Active Lots for {item.nameEn}
                                </span>
                                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                  ({activeLots.length} {activeLots.length === 1 ? "batch" : "batches"} in stock)
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleLotsExpanded(item.productId)}
                                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                Close ✕
                              </button>
                            </div>

                            {/* Lots sub-table */}
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                                  <tr>
                                    <th className="py-2.5 px-3 text-left">LOT NUMBER</th>
                                    <th className="py-2.5 px-3 text-left">BARCODE</th>
                                    <th className="py-2.5 px-3 text-center">AVAILABLE QTY</th>
                                    <th className="py-2.5 px-3 text-center">RETAIL PRICE</th>
                                    <th className="py-2.5 px-3 text-center">WHOLESALE PRICE</th>
                                    <th className="py-2.5 px-3 text-center">COST PRICE</th>
                                    <th className="py-2.5 px-3 text-center">EXPIRY DATE</th>
                                    <th className="py-2.5 px-3 text-center">ACTION</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                  {[...activeLots]
                                    .sort(
                                      (a, b) =>
                                        new Date(a.expiryDate || 0).getTime() -
                                        new Date(b.expiryDate || 0).getTime(),
                                    )
                                    .map((lot, idx) => {
                                      const lotQty = Number(
                                        lot.quantity ?? (lot as any).totalQuantity ?? 0,
                                      )
                                      const isExpired =
                                        lot.expiryDate && new Date(lot.expiryDate) < new Date()
                                      const isCritical =
                                        !isExpired &&
                                        lot.expiryDate &&
                                        new Date(lot.expiryDate).getTime() - Date.now() <
                                          30 * 24 * 60 * 60 * 1000

                                      return (
                                        <tr
                                          key={lot.lotId}
                                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                                        >
                                          {/* 1. LOT NUMBER */}
                                          <td className="py-2.5 px-3 text-left whitespace-nowrap">
                                            <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 shadow-2xs">
                                              {formatLotNumber(lot.lotNumber, idx)}
                                            </span>
                                          </td>

                                          {/* 2. BARCODE */}
                                          <td className="py-2.5 px-3 text-left font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                            {lot.lotBarcode ||
                                              lot.barcode ||
                                              lot.defaultBarcode ||
                                              "—"}
                                          </td>

                                          {/* 3. AVAILABLE QTY */}
                                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                            <div className="font-mono font-bold text-sm text-emerald-800 dark:text-emerald-400 tabular-nums">
                                              {formatQuantity(lotQty, item.baseUnit)}
                                            </div>
                                            {(() => {
                                              const mult = getEffectiveMultiplier(item.cartonMultiplier, item.packSize, item.unitSize)
                                              if (mult <= 1 || lotQty <= 0) return null
                                              const ctns = Math.floor(lotQty / mult)
                                              const loose = lotQty % mult
                                              return (
                                                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap leading-none mt-0.5 block">
                                                  {ctns > 0 ? `${ctns} ctn` : ""}
                                                  {ctns > 0 && loose > 0 ? " + " : ""}
                                                  {loose > 0 ? `${formatQuantity(loose, item.baseUnit)} ${pluralizeUnit(item.baseUnit, loose).toLowerCase()}` : ""}
                                                </span>
                                              )
                                            })()}
                                          </td>

                                          {/* 4. RETAIL PRICE */}
                                          <td className="py-2.5 px-3 text-center font-mono font-bold text-xs text-slate-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
                                            {formatTk(lot.lotRetailPrice ?? item.retailPrice)}
                                          </td>

                                          {/* 5. WHOLESALE PRICE */}
                                          <td className="py-2.5 px-3 text-center font-mono text-xs text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">
                                            {formatTk(
                                              lot.lotWholesalePrice ??
                                                item.wholesalePrice ??
                                                item.retailPrice,
                                            )}
                                          </td>

                                          {/* 6. COST PRICE */}
                                          <td className="py-2.5 px-3 text-center font-mono font-semibold text-xs text-amber-800 dark:text-amber-400 tabular-nums whitespace-nowrap">
                                            {formatTk(lot.purchaseCost ?? item.buyingPrice)}
                                          </td>

                                          {/* 7. EXPIRY DATE */}
                                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                            <div className="inline-flex items-center gap-1.5 font-mono text-[11px]">
                                              <span
                                                className={
                                                  isExpired
                                                    ? "text-rose-600 dark:text-rose-400 font-bold"
                                                    : isCritical
                                                    ? "text-amber-700 dark:text-amber-400 font-semibold"
                                                    : "text-slate-600 dark:text-slate-400"
                                                }
                                              >
                                                {lot.expiryDate || "Not set"}
                                              </span>
                                              {isExpired ? (
                                                <span className="px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
                                                  Expired
                                                </span>
                                              ) : isCritical ? (
                                                <span className="px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                                                  Expiring
                                                </span>
                                              ) : null}
                                            </div>
                                          </td>

                                          {/* 8. ACTION */}
                                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                            <div className="flex items-center justify-center gap-1.5">
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => onOpenLedger(item, lot)}
                                                title={`View stock ledger for Lot #${lot.lotNumber}`}
                                                leftIcon={<History className="w-3 h-3 text-teal-600 dark:text-teal-400" />}
                                                className="text-xs px-2 py-1 border-slate-200 dark:border-slate-700 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-slate-700 dark:text-slate-300 hover:text-teal-900 dark:hover:text-teal-200"
                                              >
                                                Stock Ledger
                                              </Button>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => onOpenAdjustment(item.productId, lot.lotId)}
                                                title={`Adjust or write off stock from Lot #${lot.lotNumber}`}
                                                leftIcon={<ShieldAlert className="w-3 h-3 text-amber-600 dark:text-amber-400" />}
                                                className="text-xs px-2 py-1 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/60"
                                              >
                                                Adjust
                                              </Button>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => onOpenSticker(lot, activeLots)}
                                                leftIcon={<Tag className="w-3 h-3 text-slate-500 dark:text-slate-400" />}
                                                className="text-xs px-2 py-1 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                                              >
                                                Sticker
                                              </Button>
                                            </div>
                                          </td>
                                        </tr>
                                      )
                                    })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
        <Pagination
          page={stockPage}
          pageSize={stockPageSize}
          totalElements={filteredProducts.length}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          pageSizeOptions={[5, 10, 15, 25, 50]}
          itemLabel="products"
        />
      </div>
    </div>
  )
}
