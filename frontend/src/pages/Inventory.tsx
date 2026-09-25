import { useState, useEffect, useMemo, useCallback } from "react"
import type {
  Product,
  StockItem,
  NavigationTab,
  GroupedProduct,
  StockAdjustmentResponse,
  InventoryLot,
} from "../types"
import { getStock, getProducts } from "../api/endpoints"
import { useToast } from "../context/ToastContext"
import BarcodeStickerModal from "../components/BarcodeStickerModal"
import StockLedgerModal from "../components/StockLedgerModal"
import StockAdjustmentModal from "../components/StockAdjustmentModal"
import Button from "../components/ui/Button"
import RefreshButton from "../components/ui/RefreshButton"
import InventoryStatCards from "../components/inventory/InventoryStatCards"
import AddProductModal from "../components/inventory/AddProductModal"
import QuickAddStockModal, { type StockModalProduct } from "../components/inventory/QuickAddStockModal"
import ProductLotsPopover, { type LotDropdownProduct } from "../components/inventory/ProductLotsPopover"
import InventoryTable from "../components/inventory/InventoryTable"
import {
  Package,
  Plus,
  X,
  History,
} from "lucide-react"

export interface InventoryProps {
  onNavigate?: (tab: NavigationTab, params?: { productId?: number; lotId?: number }) => void
}

export default function Inventory({ onNavigate }: InventoryProps = {}) {
  const { showSuccess, showError } = useToast()

  // ─── Bin Card & Stock Adjustment Modals State ──────────────────
  const [showLedgerModal, setShowLedgerModal] = useState<boolean>(false)
  const [selectedLedgerProduct, setSelectedLedgerProduct] = useState<{ id?: number; nameEn?: string; productCode?: string } | undefined>(undefined)
  const [selectedLedgerLot, setSelectedLedgerLot] = useState<{ id?: number; lotNumber?: string } | undefined>(undefined)

  const [showStockAdjustmentModal, setShowStockAdjustmentModal] = useState<boolean>(false)
  const [adjustmentInitialProduct, setAdjustmentInitialProduct] = useState<number | undefined>(undefined)
  const [adjustmentInitialLot, setAdjustmentInitialLot] = useState<number | undefined>(undefined)

  // ─── Remote Data State ──────────────────────────────────────────
  const [stocks, setStocks] = useState<StockItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // ─── Filters & Search ───────────────────────────────────────────
  const [search, setSearch] = useState<string>("")
  const [activeFilter, setActiveFilter] = useState<string>("ALL")
  const [stockPage, setStockPage] = useState<number>(0)
  const [stockPageSize, setStockPageSize] = useState<number>(15)

  // Reset page when filters change
  useEffect(() => {
    setStockPage(0)
  }, [search, activeFilter])

  const handleFilterClick = useCallback((filter: string) => {
    setActiveFilter((prev) => (prev === filter ? "ALL" : filter))
  }, [])

  // ─── Modals State ───────────────────────────────────────────────
  const [stickerItem, setStickerItem] = useState<StockItem | null>(null)
  const [stickerLots, setStickerLots] = useState<StockItem[]>([])
  const [isStickerOpen, setIsStickerOpen] = useState<boolean>(false)
  const [lotDropdownProduct, setLotDropdownProduct] = useState<LotDropdownProduct | null>(null)
  const [showAddProduct, setShowAddProduct] = useState<boolean>(false)

  // ─── Expanded Product Lots State ──────────────────────────────
  const [expandedProductIds, setExpandedProductIds] = useState<Set<number>>(new Set())

  const toggleLotsExpanded = useCallback((productId: number) => {
    setExpandedProductIds((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) {
        next.delete(productId)
      } else {
        next.add(productId)
      }
      return next
    })
  }, [])

  // ─── Quick Add Stock Modal State ────────────────────────────────
  const [stockModalProduct, setStockModalProduct] = useState<StockModalProduct | null>(null)

  // ─── Load Initial Data ──────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      const [stockData, productData] = await Promise.all([
        getStock(),
        getProducts(),
      ])
      setStocks(stockData)
      setProducts(productData)
    } catch (err) {
      showError(err, "Failed to load inventory data")
    } finally {
      setIsLoading(false)
    }
  }, [showError])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Extract categories
  const categories = useMemo(() => {
    const set = new Set<string>()
    products.forEach((p) => {
      if (p.category) set.add(p.category)
    })
    return Array.from(set).sort()
  }, [products])

  // Grouped Products by ID
  const groupedProducts: GroupedProduct[] = useMemo(() => {
    return products.map((prod) => {
      const prodStocks = stocks.filter((s) => s.productId === prod.id)
      const totalStock = prodStocks.reduce(
        (sum, s) => sum + Number(s.quantity ?? (s as any).totalQuantity ?? 0),
        0,
      )
      const latestStock = prodStocks[0]

      return {
        productId: prod.id,
        nameEn: prod.nameEn,
        nameBn: prod.nameBn,
        productCode: prod.productCode,
        category: prod.category,
        baseUnit: prod.baseUnit,
        minStockAlert: prod.minStockAlert ?? 5,
        totalStock,
        retailPrice: prod.standardRetailPrice || latestStock?.lotRetailPrice || 0,
        wholesalePrice: prod.standardWholesalePrice || latestStock?.lotWholesalePrice || prod.standardRetailPrice || 0,
        buyingPrice: prod.buyingPrice || (latestStock as any)?.purchaseCost || (prod.standardRetailPrice ? Math.round(prod.standardRetailPrice * 0.8) : 0),
        lots: prodStocks,
      }
    })
  }, [products, stocks])

  // Filtered Products
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    return groupedProducts.filter((item) => {
      // Search query filter
      if (q) {
        const matchesName = item.nameEn?.toLowerCase().includes(q)
        const matchesCode = item.productCode?.toLowerCase().includes(q)
        const matchesCategory = item.category?.toLowerCase().includes(q)
        if (!matchesName && !matchesCode && !matchesCategory) return false
      }

      // Filter chips
      if (activeFilter === "ALL") return true
      if (activeFilter === "LOW_STOCK") return item.totalStock <= item.minStockAlert
      if (activeFilter === "EXPIRING") {
        return item.lots.some((lot: StockItem) => {
          if (!lot.expiryDate) return false
          const diff = new Date(lot.expiryDate).getTime() - Date.now()
          return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000
        })
      }
      return item.category === activeFilter
    })
  }, [groupedProducts, search, activeFilter])

  // Summary Metrics
  const totalStockUnits = useMemo(() => {
    return groupedProducts.reduce((sum, p) => sum + p.totalStock, 0)
  }, [groupedProducts])

  const totalValuation = useMemo(() => {
    return groupedProducts.reduce((sum, p) => sum + p.totalStock * p.buyingPrice, 0)
  }, [groupedProducts])

  const totalRetailValuation = useMemo(() => {
    return groupedProducts.reduce((sum, p) => sum + p.totalStock * p.retailPrice, 0)
  }, [groupedProducts])

  const expiringLots = useMemo(() => {
    return stocks
      .filter((s) => {
        if (!s.expiryDate) return false
        const diff = new Date(s.expiryDate).getTime() - Date.now()
        return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000
      })
  }, [stocks])

  const lowStockCount = useMemo(() => {
    return groupedProducts.filter((p) => p.totalStock <= p.minStockAlert).length
  }, [groupedProducts])

  // Flat lots array for stock adjustment selector
  const inventoryLots = useMemo<InventoryLot[]>(() => {
    return stocks.map((s) => ({
      id: s.lotId,
      productId: s.productId,
      productCode: s.productCode,
      productNameEn: s.nameEn || s.productNameEn,
      lotNumber: s.lotNumber,
      entryDate: s.entryDate,
      expiryDate: s.expiryDate,
      purchaseCost: s.purchaseCost || 0,
      lotRetailPrice: s.lotRetailPrice || 0,
      lotWholesalePrice: s.lotWholesalePrice || 0,
      barcode: s.lotBarcode || s.barcode || "",
    }))
  }, [stocks])

  const openAddStockModal = (product: GroupedProduct) => {
    setStockModalProduct({
      productId: product.productId,
      nameEn: product.nameEn,
      baseUnit: product.baseUnit,
      retailPrice: product.retailPrice,
      wholesalePrice: product.wholesalePrice,
      buyingPrice: product.buyingPrice,
    })
  }

  const handleAdjustmentSuccess = (_adj: StockAdjustmentResponse) => {
    showSuccess("Stock adjustment recorded successfully!")
    loadData()
  }

  return (
    <div className="space-y-5">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-slate-700" />
            <span>Master Inventory Catalog</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Dokan stock availability, priced batches (FEFO), and barcode thermal printing
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              if (onNavigate) {
                onNavigate("bin-card")
              } else {
                setSelectedLedgerProduct(undefined)
                setSelectedLedgerLot(undefined)
                setShowLedgerModal(true)
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
            title="View entire immutable stock movement history on dedicated Stock Ledger page"
          >
            <History className="w-3.5 h-3.5 text-teal-700" />
            <span>Stock Ledger</span>
          </button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAddProduct((p) => !p)}
            leftIcon={showAddProduct ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          >
            {showAddProduct ? "Close Form" : "New Product"}
          </Button>

          <RefreshButton
            onClick={loadData}
            isLoading={isLoading}
            title="Refresh inventory"
          />
        </div>
      </div>

      {/* KPI Stat Cards */}
      <InventoryStatCards
        productsCount={products.length}
        totalStockUnits={totalStockUnits}
        lowStockCount={lowStockCount}
        expiringLotsCount={expiringLots.length}
        totalValuation={totalValuation}
        totalRetailValuation={totalRetailValuation}
        activeFilter={activeFilter}
        onFilterClick={handleFilterClick}
      />

      {/* Add New Product Modal / Card */}
      <AddProductModal
        isOpen={showAddProduct}
        onClose={() => setShowAddProduct(false)}
        onSuccess={loadData}
      />

      {/* Dokan Stock Inventory Table */}
      <InventoryTable
        products={products}
        groupedProducts={groupedProducts}
        filteredProducts={filteredProducts}
        categories={categories}
        isLoading={isLoading}
        search={search}
        onSearchChange={setSearch}
        activeFilter={activeFilter}
        onFilterClick={handleFilterClick}
        lowStockCount={lowStockCount}
        expiringLotsCount={expiringLots.length}
        stockPage={stockPage}
        stockPageSize={stockPageSize}
        onPageChange={setStockPage}
        onPageSizeChange={(newSize) => {
          setStockPageSize(newSize)
          setStockPage(0)
        }}
        expandedProductIds={expandedProductIds}
        toggleLotsExpanded={toggleLotsExpanded}
        openAddStockModal={openAddStockModal}
        onOpenLedger={(item, lot) => {
          if (onNavigate) {
            onNavigate("bin-card", {
              productId: item.productId,
              lotId: lot?.lotId,
            })
          } else {
            setSelectedLedgerProduct({
              id: item.productId,
              nameEn: item.nameEn,
              productCode: item.productCode,
            })
            setSelectedLedgerLot(lot ? { id: lot.lotId, lotNumber: lot.lotNumber } : undefined)
            setShowLedgerModal(true)
          }
        }}
        onOpenAdjustment={(productId, lotId) => {
          setAdjustmentInitialProduct(productId)
          setAdjustmentInitialLot(lotId)
          setShowStockAdjustmentModal(true)
        }}
        onOpenSticker={(item, lots) => {
          setStickerItem(item)
          setStickerLots(lots)
          setIsStickerOpen(true)
          setLotDropdownProduct(null)
        }}
        onOpenLotsDropdown={(productId, lots, buttonRect) => {
          if (lotDropdownProduct?.productId === productId) {
            setLotDropdownProduct(null)
          } else {
            setLotDropdownProduct({
              productId,
              rect: {
                top: buttonRect.bottom + 6,
                bottom: buttonRect.top - 6,
                right: window.innerWidth - buttonRect.right,
              },
              lots,
            })
          }
        }}
        lotDropdownProductId={lotDropdownProduct?.productId}
      />

      {/* Quick Add Dokan Stock Modal */}
      <QuickAddStockModal
        product={stockModalProduct}
        groupedProducts={groupedProducts}
        onClose={() => setStockModalProduct(null)}
        onSuccess={loadData}
      />

      {/* Floating Lot Selection Popover for Multi-Lot Products */}
      <ProductLotsPopover
        dropdown={lotDropdownProduct}
        onClose={() => setLotDropdownProduct(null)}
        onSelectLot={(lot, lots) => {
          setStickerItem(lot)
          setStickerLots(lots)
          setIsStickerOpen(true)
        }}
      />

      {/* Barcode Sticker Modal */}
      {stickerItem && (
        <BarcodeStickerModal
          item={stickerItem}
          lots={stickerLots}
          onSelectLot={(newLot) => setStickerItem(newLot)}
          isOpen={isStickerOpen}
          onClose={() => {
            setIsStickerOpen(false)
            setStickerItem(null)
            setStickerLots([])
          }}
        />
      )}

      {/* Stock Ledger History Audit Modal */}
      <StockLedgerModal
        isOpen={showLedgerModal}
        productId={selectedLedgerProduct?.id}
        productName={selectedLedgerProduct?.nameEn}
        productCode={selectedLedgerProduct?.productCode}
        lotId={selectedLedgerLot?.id}
        lotNumber={selectedLedgerLot?.lotNumber}
        onClose={() => setShowLedgerModal(false)}
      />

      {/* Stock Adjustment Modal */}
      <StockAdjustmentModal
        isOpen={showStockAdjustmentModal}
        products={products}
        lots={inventoryLots}
        initialProductId={adjustmentInitialProduct}
        initialLotId={adjustmentInitialLot}
        onClose={() => {
          setShowStockAdjustmentModal(false)
          setAdjustmentInitialProduct(undefined)
          setAdjustmentInitialLot(undefined)
        }}
        onSuccess={handleAdjustmentSuccess}
      />
    </div>
  )
}
