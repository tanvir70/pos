import { Fragment, useState, useEffect, useMemo, useCallback } from "react"
import type {
  Product,
  StockItem,
  QuarantineStockItem,
  QuarantineDisposalRequest,
  NavigationTab,
  InventoryLot,
} from "../types"
import {
  getStock,
  getProducts,
  createProduct,
  createLot,
  getQuarantineStock,
  disposeQuarantineStock,
} from "../api/endpoints"
import type { StockAdjustmentResponse } from "../types"
import { useToast } from "../context/ToastContext"
import { formatTk } from "../utils/currency"
import { getNextLotNumber, formatLotNumber } from "../utils/lotNumber"
import BarcodeStickerModal from "../components/BarcodeStickerModal"
import StockLedgerModal from "../components/StockLedgerModal"
import StockAdjustmentModal from "../components/StockAdjustmentModal"
import Button from "../components/ui/Button"
import Input from "../components/ui/Input"
import Badge from "../components/ui/Badge"
import GotposStatCard from "../components/dashboard/GotposStatCard"
import Modal from "../components/ui/Modal"
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
  TableEmptyState,
  TableLoadingState,
} from "../components/ui/Table"
import {
  Package,
  Search,
  Plus,
  X,
  Sprout,
  AlertTriangle,
  CheckCircle2,
  Wallet,
  RefreshCw,
  Biohazard,
  Tag,
  Flame,
  ChevronUp,
  ChevronDown,
  Check,
  Layers,
  Hourglass,
  History,
  ShieldAlert,
} from "lucide-react"

export interface InventoryProps {
  onNavigate?: (tab: NavigationTab, params?: { productId?: number; lotId?: number }) => void
}

export default function Inventory({ onNavigate }: InventoryProps = {}) {
  const { showSuccess, showError, showWarning } = useToast()

  const [activeTab, setActiveTab] = useState<"catalog" | "quarantine">("catalog")

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
  const [quarantineItems, setQuarantineItems] = useState<QuarantineStockItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // ─── Filters & Search ───────────────────────────────────────────
  const [search, setSearch] = useState<string>("")
  const [activeFilter, setActiveFilter] = useState<string>("ALL")

  const handleFilterClick = useCallback((filter: string) => {
    setActiveFilter((prev) => (prev === filter ? "ALL" : filter))
  }, [])

  // ─── Modals State ───────────────────────────────────────────────
  const [stickerItem, setStickerItem] = useState<StockItem | null>(null)
  const [stickerLots, setStickerLots] = useState<StockItem[]>([])
  const [isStickerOpen, setIsStickerOpen] = useState<boolean>(false)
  const [lotDropdownProduct, setLotDropdownProduct] = useState<{
    productId: number
    rect: { top: number; right: number; bottom: number }
    lots: StockItem[]
  } | null>(null)
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
  const [stockModalProduct, setStockModalProduct] = useState<{
    productId: number
    nameEn: string
    baseUnit: string
    retailPrice: number
    wholesalePrice: number
    buyingPrice: number
  } | null>(null)
  const [addStockQty, setAddStockQty] = useState("")
  const [addStockBuying, setAddStockBuying] = useState("")
  const [addStockRetail, setAddStockRetail] = useState("")
  const [addStockWholesale, setAddStockWholesale] = useState("")
  const [addStockLotNumber, setAddStockLotNumber] = useState("")
  const [addStockExpiry, setAddStockExpiry] = useState("")
  const [addStockSupplier, setAddStockSupplier] = useState("")
  const [addStockChallan, setAddStockChallan] = useState("")
  const [isAddingStock, setIsAddingStock] = useState(false)

  // Quarantine Disposal Modal State
  const [selectedQuarantineItem, setSelectedQuarantineItem] =
    useState<QuarantineStockItem | null>(null)
  const [disposalQty, setDisposalQty] = useState<string>("")
  const [disposalType, setDisposalType] = useState<string>("WRITE_OFF")
  const [disposalRemarks, setDisposalRemarks] = useState<string>("")
  const [isDisposing, setIsDisposing] = useState<boolean>(false)

  // ─── New Product & Stock Form State ─────────────────────────────
  const [newProdName, setNewProdName] = useState("")
  const [newProdCode, setNewProdCode] = useState("")
  const [newProdCategory, setNewProdCategory] = useState("Insecticide")
  const [newProdBaseUnit, setNewProdBaseUnit] = useState("Bottle")
  const [newProdInitialStock, setNewProdInitialStock] = useState("")
  const [newProdRetail, setNewProdRetail] = useState("")
  const [newProdBuying, setNewProdBuying] = useState("")
  const [newProdMinStock, setNewProdMinStock] = useState("5")
  const [isSavingProd, setIsSavingProd] = useState(false)

  // ─── Load Initial Data ──────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      const [stockData, productData, quarantineData] = await Promise.all([
        getStock(),
        getProducts(),
        getQuarantineStock().catch(() => []),
      ])
      setStocks(stockData)
      setProducts(productData)
      setQuarantineItems(quarantineData)
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
      if (p.category) set.add(p.category.trim())
    })
    return Array.from(set).sort()
  }, [products])

  // Group stocks by productId
  const groupedProducts = useMemo(() => {
    const map = new Map<
      number,
      {
        product: Product | null
        productId: number
        productCode: string
        nameEn: string
        nameBn: string
        category: string
        baseUnit: string
        cartonMultiplier: number
        minStockAlert: number
        retailPrice: number
        wholesalePrice: number
        buyingPrice: number
        totalStock: number
        lots: StockItem[]
      }
    >()

    // Initialize from master products
    for (const prod of products) {
      map.set(prod.id, {
        product: prod,
        productId: prod.id,
        productCode: prod.productCode,
        nameEn: prod.nameEn,
        nameBn: prod.nameBn,
        category: prod.category,
        baseUnit: prod.baseUnit,
        cartonMultiplier: prod.cartonMultiplier || 1,
        minStockAlert: prod.minStockAlert,
        retailPrice: prod.standardRetailPrice,
        wholesalePrice: prod.standardWholesalePrice ?? prod.standardRetailPrice,
        buyingPrice: prod.buyingPrice ?? (prod.standardWholesalePrice ? Math.round(prod.standardWholesalePrice * 0.88) : 0),
        totalStock: 0,
        lots: [],
      })
    }

    // Add lots
    for (const stock of stocks) {
      const pId = stock.productId
      let entry = map.get(pId)
      if (!entry) {
        entry = {
          product: null,
          productId: pId,
          productCode: stock.productCode,
          nameEn: stock.productNameEn || stock.nameEn,
          nameBn: stock.productNameBn || stock.nameBn,
          category: stock.category,
          baseUnit: stock.baseUnit,
          cartonMultiplier: stock.cartonMultiplier || 1,
          minStockAlert: 5,
          retailPrice: (stock as any).lotRetailPrice || stock.standardRetailPrice || 0,
          wholesalePrice: (stock as any).lotWholesalePrice || stock.standardWholesalePrice || (stock as any).lotRetailPrice || stock.standardRetailPrice || 0,
          buyingPrice: (stock as any).buyingPrice || (stock as any).purchaseCost || (stock.standardWholesalePrice ? Math.round(stock.standardWholesalePrice * 0.88) : 0),
          totalStock: 0,
          lots: [],
        }
        map.set(pId, entry)
      }
      entry.totalStock += Number(stock.quantity ?? (stock as any).totalQuantity) || 0
      entry.lots.push(stock)
      // If lot has actual purchase cost, prioritize it for accurate buying price
      if ((stock as any).purchaseCost && !entry.buyingPrice) {
        entry.buyingPrice = (stock as any).purchaseCost
      }
    }

    return Array.from(map.values())
  }, [products, stocks])

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

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return groupedProducts.filter((item) => {
      // 1. Search Query Filter
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const matchCode = item.productCode.toLowerCase().includes(q)
        const matchEn = item.nameEn.toLowerCase().includes(q)
        const matchBn = item.nameBn ? item.nameBn.toLowerCase().includes(q) : false
        const matchLot = item.lots.some(
          (l) =>
            ((l as any).lotNumber?.toLowerCase().includes(q) ||
              (l as any).barcode?.toLowerCase().includes(q)),
        )
        if (!matchCode && !matchEn && !matchBn && !matchLot) {
          return false
        }
      }

      // 2. Active Tab / Filter Pill
      if (activeFilter === "ALL") {
        return true
      }

      if (activeFilter === "LOW_STOCK") {
        return item.totalStock <= item.minStockAlert
      }

      if (activeFilter === "EXPIRING") {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        return item.lots.some((lot) => {
          const qty = Number(lot.quantity ?? (lot as any).totalQuantity) || 0
          if (qty <= 0 || !lot.expiryDate) return false
          const exp = new Date(lot.expiryDate)
          if (isNaN(exp.getTime())) return false
          const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          return diffDays <= 30
        })
      }

      // Otherwise, category filter
      return item.category === activeFilter
    })
  }, [groupedProducts, activeFilter, search])

  // Summary Metrics
  const totalStockUnits = useMemo(
    () => groupedProducts.reduce((sum, p) => sum + p.totalStock, 0),
    [groupedProducts],
  )
  const lowStockCount = useMemo(
    () => groupedProducts.filter((p) => p.totalStock <= p.minStockAlert).length,
    [groupedProducts],
  )
  const totalValuation = useMemo(() => {
    return stocks.reduce(
      (sum, s) =>
        sum +
        (Number(s.quantity ?? (s as any).totalQuantity) || 0) *
          ((s as any).purchaseCost || 0),
      0,
    )
  }, [stocks])

  const totalRetailValuation = useMemo(() => {
    return stocks.reduce(
      (sum, s) =>
        sum +
        (Number(s.quantity ?? (s as any).totalQuantity) || 0) *
          ((s as any).lotRetailPrice || (s as any).standardRetailPrice || 0),
      0,
    )
  }, [stocks])

  const totalQuarantineLoss = useMemo(() => {
    return quarantineItems.reduce(
      (sum, item) => sum + (item.totalLossValue || item.quarantineQuantity * item.purchaseCost),
      0,
    )
  }, [quarantineItems])

  // Lots at Risk of Expiring (< 30 days)
  const expiringLots = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return stocks
      .filter((s) => {
        const qty = Number(s.quantity ?? (s as any).totalQuantity) || 0
        if (qty <= 0 || !s.expiryDate) return false
        const exp = new Date(s.expiryDate)
        if (isNaN(exp.getTime())) return false
        const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        return diffDays <= 30
      })
      .map((s) => {
        const exp = new Date(s.expiryDate)
        const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        return {
          ...s,
          daysUntilExpiry: diffDays,
        }
      })
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
  }, [stocks])

  // Products with Low Stock (at or below minStockAlert threshold)
  const lowStockList = useMemo(() => {
    return groupedProducts
      .filter((p) => p.totalStock <= p.minStockAlert)
      .map((p) => ({
        ...p,
        shortage: Math.max(0, p.minStockAlert - p.totalStock),
      }))
      .sort((a, b) => b.shortage - a.shortage)
  }, [groupedProducts])

  // ─── Create Product & Initial Stock Handler ──────────────────────
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProdName.trim()) {
      showWarning("Product name is required!")
      return
    }

    try {
      setIsSavingProd(true)
      const code =
        newProdCode.trim() ||
        `SYN-${newProdName.replace(/\s+/g, "-").toUpperCase().slice(0, 6)}`
      const retail = parseFloat(newProdRetail) || 0
      const buying = parseFloat(newProdBuying) || 0
      const initialStock = parseFloat(newProdInitialStock) || 0

      const created = await createProduct({
        productCode: code,
        nameEn: newProdName.trim(),
        nameBn: newProdName.trim(), // satisfies database constraint without requiring Bangla input
        companyName: "Agro Chem",
        category: newProdCategory,
        baseUnit: newProdBaseUnit,
        cartonMultiplier: 1,
        standardRetailPrice: retail,
        buyingPrice: buying,
        minStockAlert: parseInt(newProdMinStock) || 5,
        defaultBarcode: `${code}-DEF`,
      })

      if (initialStock > 0 && created.id) {
        await createLot({
          productId: created.id,
          lotNumber: "LOT-01",
          quantityBaseUnits: initialStock,
          purchaseCost: buying,
          lotRetailPrice: retail,
          lotWholesalePrice: retail,
          entryDate: new Date().toISOString().split("T")[0],
          expiryDate: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          supplierName: "Agro Chemical Ltd.",
          challanNo: `CH-${Date.now().toString().slice(-6)}`,
        })
      }

      setShowAddProduct(false)
      setNewProdName("")
      setNewProdCode("")
      setNewProdInitialStock("")
      setNewProdRetail("")
      setNewProdBuying("")
      showSuccess("New product added to Dokan Stock successfully!")
      await loadData()
    } catch (err) {
      showError(err, "Failed to create product")
    } finally {
      setIsSavingProd(false)
    }
  }

  // ─── Quick Add Stock Modal Opener ────────────────────────────────
  const openAddStockModal = (product: {
    productId: number
    nameEn: string
    baseUnit: string
    retailPrice?: number
    wholesalePrice?: number
    buyingPrice?: number
    lots?: StockItem[]
  }) => {
    const matched = groupedProducts.find((p) => p.productId === product.productId)
    const productLots = matched?.lots || product.lots || []
    const latestLot = productLots[productLots.length - 1]
    const retailPrice = latestLot?.lotRetailPrice ?? product.retailPrice ?? 0
    const wholesalePrice = latestLot?.lotWholesalePrice ?? product.wholesalePrice ?? retailPrice
    const buyingPrice = (latestLot as any)?.purchaseCost ?? product.buyingPrice ?? 0

    setStockModalProduct({
      productId: product.productId,
      nameEn: product.nameEn,
      baseUnit: product.baseUnit,
      retailPrice,
      wholesalePrice,
      buyingPrice,
    })
    setAddStockQty("")
    setAddStockBuying(String(buyingPrice || ""))
    setAddStockRetail(String(retailPrice || ""))
    setAddStockWholesale(String(wholesalePrice || retailPrice || ""))
    setAddStockLotNumber(getNextLotNumber(productLots))
    setAddStockExpiry("")
    setAddStockSupplier((latestLot as any)?.supplierName || "")
    setAddStockChallan("")
  }

  // ─── Quick Add Stock to Existing Product ─────────────────────────
  const handleAddStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stockModalProduct) return
    const qty = parseFloat(addStockQty)
    if (isNaN(qty) || qty <= 0) {
      showWarning("Please enter a valid stock quantity greater than 0")
      return
    }

    try {
      setIsAddingStock(true)
      const buying = parseFloat(addStockBuying) || stockModalProduct.buyingPrice || 0
      const retail = parseFloat(addStockRetail) || stockModalProduct.retailPrice || 0
      const wholesale = parseFloat(addStockWholesale) || stockModalProduct.wholesalePrice || retail

      if (retail <= 0) {
        showWarning("Please enter a valid retail price")
        return
      }

      if (wholesale <= 0) {
        showWarning("Please enter a valid wholesale price")
        return
      }

      const matched = groupedProducts.find((p) => p.productId === stockModalProduct.productId)
      const defaultLot = getNextLotNumber(matched?.lots)
      const lotNumber = addStockLotNumber.trim() || defaultLot
      const challanNo = addStockChallan.trim() || `CH-${Date.now().toString().slice(-6)}`
      const expiryDate =
        addStockExpiry ||
        new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

      await createLot({
        productId: stockModalProduct.productId,
        lotNumber,
        quantityBaseUnits: qty,
        purchaseCost: buying,
        lotRetailPrice: retail,
        lotWholesalePrice: wholesale,
        entryDate: new Date().toISOString().split("T")[0],
        expiryDate,
        supplierName: addStockSupplier.trim() || "Direct stock entry",
        challanNo,
      })

      showSuccess(
        `Added ${qty} ${stockModalProduct.baseUnit} to ${stockModalProduct.nameEn} as ${lotNumber}`,
      )
      setStockModalProduct(null)
      setAddStockQty("")
      setAddStockBuying("")
      setAddStockRetail("")
      setAddStockWholesale("")
      setAddStockLotNumber("")
      setAddStockExpiry("")
      setAddStockSupplier("")
      setAddStockChallan("")
      await loadData()
    } catch (err) {
      showError(err, "Failed to add stock")
    } finally {
      setIsAddingStock(false)
    }
  }

  // ─── Quarantine Disposal Execution ──────────────────────────────
  const handleOpenDisposalModal = (item: QuarantineStockItem) => {
    setSelectedQuarantineItem(item)
    setDisposalQty(String(item.quarantineQuantity))
    setDisposalType("WRITE_OFF")
    setDisposalRemarks("")
  }

  const handleExecuteDisposal = async () => {
    if (!selectedQuarantineItem) return
    const qty = parseFloat(disposalQty)
    if (isNaN(qty) || qty <= 0) {
      showWarning("Enter a valid quantity")
      return
    }
    if (qty > selectedQuarantineItem.quarantineQuantity) {
      showWarning("Cannot dispose more than the quantity in quarantine!")
      return
    }

    const payload: QuarantineDisposalRequest = {
      lotId: selectedQuarantineItem.lotId,
      quantity: qty,
      disposalType: disposalType,
      remarks: disposalRemarks.trim() || undefined,
    }

    try {
      setIsDisposing(true)
      await disposeQuarantineStock(payload)
      showSuccess(
        `${qty} unit(s) of damaged chemical from lot #${selectedQuarantineItem.lotNumber} disposed of successfully!`,
      )
      setSelectedQuarantineItem(null)
      await loadData()
    } catch (err) {
      showError(err, "Disposal failed")
    } finally {
      setIsDisposing(false)
    }
  }

  // ─── Stock Adjustment Success Callback ───────────────────────────
  const handleAdjustmentSuccess = (adj: StockAdjustmentResponse) => {
    showSuccess(
      `Stock adjustment ${adj.adjustmentNo} recorded! (${adj.quantity} units, loss: ${formatTk(adj.totalLossValue)})`
    )
    loadData()
  }

  return (
    <div className="space-y-4">
      {/* Top Banner & Tab Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-slate-700" />
            <span>Dokan Stock Management</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time dokan stock, barcode stickers, and quarantine
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Tab Switcher */}
          <div className="inline-flex bg-slate-50 p-0.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab("catalog")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "catalog"
                  ? "bg-white text-emerald-800 shadow-xs border border-slate-200/60"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Dokan Stock ({stocks.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("quarantine")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "quarantine"
                  ? "bg-red-600 text-white shadow-xs"
                  : "text-red-600 hover:bg-red-50"
              }`}
            >
              <Biohazard className="w-3.5 h-3.5" />
              <span>Quarantine</span>
              {quarantineItems.length > 0 && (
                <span className="bg-red-800 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                  {quarantineItems.length}
                </span>
              )}
            </button>
          </div>

          {activeTab === "catalog" && (
            <>
              <button
                type="button"
                onClick={() => {
                  setAdjustmentInitialProduct(undefined)
                  setAdjustmentInitialLot(undefined)
                  setShowStockAdjustmentModal(true)
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
                title="Record breakage, bottle leakage, or physical count variance"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
                <span>Adjust / Damage</span>
              </button>

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
            </>
          )}

          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-900 rounded-xl border border-slate-200 cursor-pointer transition-colors text-xs"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ─── TAB 1: CATALOG & DOKAN STOCK ────────────────────────── */}
      {activeTab === "catalog" && (
        <>
          {/* KPI Stat Cards (Unified height & width across all 5 cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {/* 1. Registered Products */}
            <GotposStatCard
              title="Registered SKUs"
              value={products.length}
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
              value={lowStockList.length}
              valueColor={lowStockList.length > 0 ? "text-amber-700" : "text-slate-900"}
              subtitle={
                lowStockList.length > 0 ? (
                  <span className="text-amber-700 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    {lowStockList.length} below threshold • {activeFilter === "LOW_STOCK" ? "Filter active (click to reset)" : "Click to filter"}
                  </span>
                ) : (
                  <span className="text-emerald-600 font-medium">All stock levels healthy</span>
                )
              }
              theme={lowStockList.length > 0 ? "amber" : "emerald"}
              icon={<AlertTriangle className="w-5 h-5" />}
              onClick={() => handleFilterClick("LOW_STOCK")}
              className={`cursor-pointer hover:border-amber-300 shadow-xs transition-all ${
                activeFilter === "LOW_STOCK" ? "ring-2 ring-amber-500 border-amber-400 bg-amber-50/20" : ""
              }`}
            />

            {/* 4. Lots at Risk of Expiring (< 30 days) (Click to filter table) */}
            <GotposStatCard
              title="Expiring Lots (< 30d)"
              value={expiringLots.length}
              valueColor={expiringLots.length > 0 ? "text-rose-600" : "text-slate-900"}
              subtitle={
                expiringLots.length > 0 ? (
                  <span className="text-rose-600 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                    {expiringLots.length} at risk (&lt; 30d) • {activeFilter === "EXPIRING" ? "Filter active (click to reset)" : "Click to filter"}
                  </span>
                ) : (
                  <span className="text-emerald-600 font-medium">All shelf lives safe</span>
                )
              }
              theme={expiringLots.length > 0 ? "rose" : "emerald"}
              icon={<Hourglass className="w-5 h-5" />}
              onClick={() => handleFilterClick("EXPIRING")}
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

          {/* New Product Inline Card */}
          {showAddProduct && (
            <div className="bg-white p-5 rounded-2xl border-2 border-emerald-500 shadow-md animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 mb-4">
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  <span>Add New Product to Master Catalog</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddProduct(false)}
                  className="text-slate-500 hover:text-slate-900 text-sm p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateProduct} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Product Name"
                    required
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    placeholder="e.g. Virtako 40WG"
                    autoFocus
                  />
                  <Input
                    label="Product Code (optional)"
                    value={newProdCode}
                    onChange={(e) => setNewProdCode(e.target.value)}
                    placeholder="e.g. SYN-VIRT-100"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-900 mb-1">
                      Category
                    </label>
                    <select
                      value={newProdCategory}
                      onChange={(e) => setNewProdCategory(e.target.value)}
                      className="w-full text-xs py-2.5 px-3 bg-white border border-slate-200 rounded-xl focus:border-emerald-600 focus:outline-hidden cursor-pointer font-medium"
                    >
                      <option value="Insecticide">Insecticide</option>
                      <option value="Fungicide">Fungicide</option>
                      <option value="Herbicide">Herbicide</option>
                      <option value="Bio-stimulant">Bio-stimulant (Growth Promoter)</option>
                      <option value="Seed">Seed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-900 mb-1">
                      Packaging Unit
                    </label>
                    <select
                      value={newProdBaseUnit}
                      onChange={(e) => setNewProdBaseUnit(e.target.value)}
                      className="w-full text-xs py-2.5 px-3 bg-white border border-slate-200 rounded-xl focus:border-emerald-600 focus:outline-hidden cursor-pointer font-medium"
                    >
                      <option value="Bottle">Bottle</option>
                      <option value="Packet">Packet</option>
                      <option value="Kg">Kg</option>
                      <option value="Gram">Gram</option>
                      <option value="Liter">Liter</option>
                      <option value="Milliliter">Mili Liters (ml)</option>
                      <option value="Piece">Piece</option>
                    </select>
                  </div>

                  <Input
                    label="Initial Stock Quantity"
                    type="number"
                    step="any"
                    min="0"
                    value={newProdInitialStock}
                    onChange={(e) => setNewProdInitialStock(e.target.value)}
                    placeholder="0"
                    helperText="Initial quantity to add to dokan stock"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    label="Retail Price (৳)"
                    type="number"
                    step="0.01"
                    required
                    value={newProdRetail}
                    onChange={(e) => setNewProdRetail(e.target.value)}
                    placeholder="0.00"
                    helperText="Counter retail selling price"
                  />
                  <Input
                    label="Buying Price (৳)"
                    type="number"
                    step="0.01"
                    required
                    value={newProdBuying}
                    onChange={(e) => setNewProdBuying(e.target.value)}
                    placeholder="0.00"
                    helperText="Purchase cost / কেনা দাম"
                  />
                  <Input
                    label="Low Stock Alert Threshold"
                    type="number"
                    value={newProdMinStock}
                    onChange={(e) => setNewProdMinStock(e.target.value)}
                    placeholder="5"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    onClick={() => setShowAddProduct(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={isSavingProd}
                  >
                    Save Product
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Search & Category Filter Bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1 max-w-md">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClear={() => setSearch("")}
                placeholder="Search by product name or code..."
                leftAdornment={<Search className="w-4 h-4 text-slate-400" />}
                inputSize="sm"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {/* 1. All */}
              <button
                type="button"
                onClick={() => setActiveFilter("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  activeFilter === "ALL"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                All ({products.length})
              </button>

              {/* 2. Categories */}
              {categories.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => handleFilterClick(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap transition-all ${
                    activeFilter === cat
                      ? "bg-emerald-700 text-white shadow-xs ring-1 ring-emerald-800"
                      : "bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  {cat}
                </button>
              ))}

              {/* 3. Low Stock */}
              <button
                type="button"
                onClick={() => handleFilterClick("LOW_STOCK")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap border flex items-center gap-1.5 transition-all ${
                  activeFilter === "LOW_STOCK"
                    ? "bg-amber-600 text-white border-amber-700 shadow-xs ring-1 ring-amber-700"
                    : lowStockCount > 0
                    ? "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <AlertTriangle className={`w-3.5 h-3.5 ${activeFilter === "LOW_STOCK" ? "text-white" : "text-amber-600"}`} />
                <span>Low Stock</span>
                {lowStockCount > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                      activeFilter === "LOW_STOCK"
                        ? "bg-amber-800 text-white"
                        : "bg-amber-200 text-amber-900"
                    }`}
                  >
                    {lowStockCount}
                  </span>
                )}
              </button>

              {/* 4. Expiring Lots (< 30d) */}
              <button
                type="button"
                onClick={() => handleFilterClick("EXPIRING")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap border flex items-center gap-1.5 transition-all ${
                  activeFilter === "EXPIRING"
                    ? "bg-rose-600 text-white border-rose-700 shadow-xs ring-1 ring-rose-700"
                    : expiringLots.length > 0
                    ? "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100"
                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Hourglass className={`w-3.5 h-3.5 ${activeFilter === "EXPIRING" ? "text-white" : "text-rose-600"}`} />
                <span>Expiring (&lt; 30d)</span>
                {expiringLots.length > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                      activeFilter === "EXPIRING"
                        ? "bg-rose-800 text-white"
                        : "bg-rose-200 text-rose-900"
                    }`}
                  >
                    {expiringLots.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Active Filter Status Banner */}
          {activeFilter !== "ALL" && (
            <div className="flex items-center justify-between px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-500">Filtered by:</span>
                <span className="px-2 py-0.5 rounded-md font-bold bg-white border border-slate-300 text-slate-900 shadow-2xs">
                  {activeFilter === "LOW_STOCK"
                    ? "Low Stock Alert"
                    : activeFilter === "EXPIRING"
                    ? "Expiring Lots (< 30 Days)"
                    : activeFilter}
                </span>
                <span className="text-slate-500 font-medium">
                  ({filteredProducts.length} {filteredProducts.length === 1 ? "product found" : "products found"})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveFilter("ALL")}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer hover:underline"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset to All</span>
              </button>
            </div>
          )}

          {/* Dokan Stock Inventory Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Product &amp; Code</TableHeaderCell>
                  <TableHeaderCell>Category</TableHeaderCell>
                  <TableHeaderCell>Packaging Unit</TableHeaderCell>
                  <TableHeaderCell align="center">Dokan Stock</TableHeaderCell>
                  <TableHeaderCell align="right">Retail Price</TableHeaderCell>
                  <TableHeaderCell align="right">Buying Price</TableHeaderCell>
                  <TableHeaderCell align="right">Actions</TableHeaderCell>
                </TableRow>
              </TableHead>
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
                  filteredProducts.map((item) => {
                    const isLowStock = item.totalStock <= item.minStockAlert
                    const isExpanded = expandedProductIds.has(item.productId)
                    const activeLots = item.lots.filter(
                      (lot) => Number(lot.quantity ?? (lot as any).totalQuantity ?? 0) > 0,
                    )

                    return (
                      <Fragment key={item.productId}>
                        <TableRow className={isLowStock ? "bg-amber-50/30" : ""}>
                          {/* Product Info */}
                          <TableCell>
                            <div>
                              <div className="font-bold text-slate-900 text-sm">
                                {item.nameEn}
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-2">
                                <span className="font-mono text-emerald-800 font-semibold">
                                  #{item.productCode}
                                </span>
                              </div>
                            </div>
                          </TableCell>

                          {/* Category */}
                          <TableCell>
                            <span className="text-xs px-2 py-0.5 rounded-lg bg-slate-50 font-semibold text-slate-900 border border-slate-200">
                              {item.category}
                            </span>
                          </TableCell>

                          {/* Packaging */}
                          <TableCell>
                            <span className="text-xs font-semibold text-slate-900 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                              {item.baseUnit}
                            </span>
                          </TableCell>

                          {/* Dokan Stock */}
                          <TableCell align="center">
                            <div className="flex items-center justify-center gap-2">
                              {item.totalStock <= 0 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                  0 Out of Stock
                                </span>
                              ) : isLowStock ? (
                                <span
                                  className="inline-flex items-center gap-1.5 font-mono font-bold text-sm text-amber-900 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200"
                                  title={
                                    activeLots[0]
                                      ? `Lot: ${formatLotNumber(activeLots[0].lotNumber)} | Expiry: ${activeLots[0].expiryDate || "N/A"}`
                                      : undefined
                                  }
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                  {item.totalStock}
                                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-tight">
                                    Low
                                  </span>
                                </span>
                              ) : (
                                <span
                                  className="font-mono font-bold text-sm text-slate-900 tabular-nums px-1"
                                  title={
                                    activeLots[0]
                                      ? `Lot: ${formatLotNumber(activeLots[0].lotNumber)} | Expiry: ${activeLots[0].expiryDate || "N/A"}`
                                      : undefined
                                  }
                                >
                                  {item.totalStock}
                                </span>
                              )}

                              {/* Smart Multi-Lot Tag: only shown when 2 or more distinct active lots exist */}
                              {activeLots.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => toggleLotsExpanded(item.productId)}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border transition-all cursor-pointer ${
                                    isExpanded
                                      ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                                      : "bg-emerald-50 text-emerald-800 border-emerald-200/80 hover:bg-emerald-100 hover:border-emerald-300"
                                  }`}
                                  title={
                                    isExpanded
                                      ? "Collapse lot batches"
                                      : `View ${activeLots.length} separate batches`
                                  }
                                >
                                  <Layers className="w-3 h-3" />
                                  <span>{activeLots.length} Lots</span>
                                  {isExpanded ? (
                                    <ChevronUp className="w-3 h-3" />
                                  ) : (
                                    <ChevronDown className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                            </div>
                          </TableCell>

                          {/* Retail Price */}
                          <TableCell align="right" isMonospace className="font-bold text-slate-900">
                            {formatTk(item.retailPrice)}
                          </TableCell>

                          {/* Buying Price */}
                          <TableCell align="right" isMonospace>
                            <span className="text-amber-800 font-bold">
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
                                className="text-xs px-2 py-1 bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                              >
                                Stock
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (onNavigate) {
                                    onNavigate("bin-card", { productId: item.productId })
                                  } else {
                                    setSelectedLedgerProduct({
                                      id: item.productId,
                                      nameEn: item.nameEn,
                                      productCode: item.productCode,
                                    })
                                    setSelectedLedgerLot(undefined)
                                    setShowLedgerModal(true)
                                  }
                                }}
                                title={`View stock ledger for ${item.nameEn}`}
                                leftIcon={<History className="w-3.5 h-3.5 text-teal-600" />}
                                className="text-xs px-2 py-1 border-slate-200 hover:bg-teal-50 text-slate-700 hover:text-teal-900"
                              >
                                Stock Ledger
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setAdjustmentInitialProduct(item.productId)
                                  setAdjustmentInitialLot(undefined)
                                  setShowStockAdjustmentModal(true)
                                }}
                                title={`Record breakage, damage, or adjustment for ${item.nameEn}`}
                                leftIcon={<ShieldAlert className="w-3.5 h-3.5 text-amber-600" />}
                                className="text-xs px-2 py-1 bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                              >
                                Adjust
                              </Button>
                              {activeLots.length > 0 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    if (activeLots.length === 1) {
                                      setStickerItem(activeLots[0])
                                      setStickerLots(activeLots)
                                      setIsStickerOpen(true)
                                      setLotDropdownProduct(null)
                                    } else {
                                      if (lotDropdownProduct?.productId === item.productId) {
                                        setLotDropdownProduct(null)
                                      } else {
                                        const buttonRect = e.currentTarget.getBoundingClientRect()
                                        setLotDropdownProduct({
                                          productId: item.productId,
                                          rect: {
                                            top: buttonRect.bottom + 6,
                                            bottom: buttonRect.top - 6,
                                            right: window.innerWidth - buttonRect.right,
                                          },
                                          lots: activeLots,
                                        })
                                      }
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
                                          lotDropdownProduct?.productId === item.productId
                                            ? "rotate-180 text-emerald-700"
                                            : "text-slate-400"
                                        }`}
                                      />
                                    ) : undefined
                                  }
                                  className={`text-xs px-2 py-1 transition-all ${
                                    lotDropdownProduct?.productId === item.productId
                                      ? "bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-400"
                                      : ""
                                  }`}
                                >
                                  <span>Sticker</span>
                                  {activeLots.length > 1 && (
                                    <span className="text-[10px] px-1 py-0.2 bg-slate-100 rounded text-slate-600 font-bold ml-0.5">
                                      {activeLots.length}
                                    </span>
                                  )}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Expandable Active Lots Sub-Table with restored column naming & aligned values */}
                        {isExpanded && activeLots.length > 0 && (
                          <TableRow className="bg-slate-50/60 hover:bg-slate-50/60 border-t border-b border-slate-200">
                            <TableCell colSpan={7} className="p-3 sm:p-4">
                              <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
                                {/* Header bar */}
                                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-emerald-100 text-emerald-800">
                                      <Layers className="w-3.5 h-3.5" />
                                    </span>
                                    <span className="text-xs font-bold text-slate-900">
                                      Active Lots for {item.nameEn}
                                    </span>
                                    <span className="text-[11px] font-medium text-slate-500">
                                      ({activeLots.length} {activeLots.length === 1 ? "batch" : "batches"} in stock • Zero-stock lots hidden)
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => toggleLotsExpanded(item.productId)}
                                    className="text-xs text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                                  >
                                    Close ✕
                                  </button>
                                </div>

                                {/* Lots sub-table with previous column naming & aligned headers/row values */}
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 text-slate-500 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
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
                                    <tbody className="divide-y divide-slate-100">
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
                                              className="hover:bg-slate-50/70 transition-colors"
                                            >
                                              {/* 1. LOT NUMBER */}
                                              <td className="py-2.5 px-3 text-left whitespace-nowrap">
                                                <span className="font-mono font-bold text-xs text-slate-900 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                                                  {formatLotNumber(lot.lotNumber, idx)}
                                                </span>
                                              </td>

                                              {/* 2. BARCODE */}
                                              <td className="py-2.5 px-3 text-left font-mono text-[11px] text-slate-500 whitespace-nowrap">
                                                {lot.lotBarcode ||
                                                  lot.barcode ||
                                                  lot.defaultBarcode ||
                                                  "—"}
                                              </td>

                                              {/* 3. AVAILABLE QTY (Aligned center directly under header, no packaging unit) */}
                                              <td className="py-2.5 px-3 text-center font-mono font-bold text-sm text-emerald-800 tabular-nums whitespace-nowrap">
                                                {lotQty}
                                              </td>

                                              {/* 4. RETAIL PRICE (Aligned center directly with header) */}
                                              <td className="py-2.5 px-3 text-center font-mono font-bold text-xs text-slate-900 tabular-nums whitespace-nowrap">
                                                {formatTk(lot.lotRetailPrice ?? item.retailPrice)}
                                              </td>

                                              {/* 5. WHOLESALE PRICE (Aligned center directly with header) */}
                                              <td className="py-2.5 px-3 text-center font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                                                {formatTk(
                                                  lot.lotWholesalePrice ??
                                                    item.wholesalePrice ??
                                                    item.retailPrice,
                                                )}
                                              </td>

                                              {/* 6. COST PRICE (Aligned center directly with header) */}
                                              <td className="py-2.5 px-3 text-center font-mono font-semibold text-xs text-amber-800 tabular-nums whitespace-nowrap">
                                                {formatTk(lot.purchaseCost ?? item.buyingPrice)}
                                              </td>

                                              {/* 7. EXPIRY DATE (Aligned center directly with header) */}
                                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                <div className="inline-flex items-center gap-1.5 font-mono text-[11px]">
                                                  <span
                                                    className={
                                                      isExpired
                                                        ? "text-rose-600 font-bold"
                                                        : isCritical
                                                        ? "text-amber-700 font-semibold"
                                                        : "text-slate-600"
                                                    }
                                                  >
                                                    {lot.expiryDate || "Not set"}
                                                  </span>
                                                  {isExpired ? (
                                                    <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 text-[10px] font-bold">
                                                      Expired
                                                    </span>
                                                  ) : isCritical ? (
                                                    <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                                                      Expiring
                                                    </span>
                                                  ) : null}
                                                </div>
                                              </td>

                                              {/* 8. ACTION (Aligned center directly with header) */}
                                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <Button
                                                      variant="outline"
                                                      size="sm"
                                                      onClick={() => {
                                                        if (onNavigate) {
                                                          onNavigate("bin-card", {
                                                            productId: item.productId,
                                                            lotId: lot.lotId,
                                                          })
                                                        } else {
                                                          setSelectedLedgerProduct({
                                                            id: item.productId,
                                                            nameEn: item.nameEn,
                                                            productCode: item.productCode,
                                                          })
                                                          setSelectedLedgerLot({
                                                            id: lot.lotId,
                                                            lotNumber: lot.lotNumber,
                                                          })
                                                          setShowLedgerModal(true)
                                                        }
                                                      }}
                                                      title={`View stock ledger for Lot #${lot.lotNumber}`}
                                                      leftIcon={<History className="w-3 h-3 text-teal-600" />}
                                                      className="text-xs px-2 py-1 border-slate-200 hover:bg-teal-50 text-slate-700 hover:text-teal-900"
                                                    >
                                                      Stock Ledger
                                                    </Button>
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                      setAdjustmentInitialProduct(item.productId)
                                                      setAdjustmentInitialLot(lot.lotId)
                                                      setShowStockAdjustmentModal(true)
                                                    }}
                                                    title={`Adjust or write off stock from Lot #${lot.lotNumber}`}
                                                    leftIcon={<ShieldAlert className="w-3 h-3 text-amber-600" />}
                                                    className="text-xs px-2 py-1 bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                                                  >
                                                    Adjust
                                                  </Button>
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                      setStickerItem(lot)
                                                      setStickerLots(activeLots)
                                                      setIsStickerOpen(true)
                                                    }}
                                                    leftIcon={<Tag className="w-3 h-3 text-slate-500" />}
                                                    className="text-xs px-2 py-1 border-slate-300 hover:bg-slate-100"
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
          </div>
        </>
      )}

      {/* ─── TAB 2: QUARANTINE & DAMAGED CHEMICALS ───────────────── */}
      {activeTab === "quarantine" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Quarantine Overview Card */}
          <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Biohazard className="w-8 h-8 text-red-700 shrink-0" />
              <div>
                <h3 className="font-bold text-base text-red-950">
                  Damaged &amp; Quarantined Chemical Isolation
                </h3>
                <p className="text-xs text-red-800 mt-0.5">
                  Expired or damaged chemical goods are stored separately, isolated from
                  sellable stock.
                </p>
              </div>
            </div>

            <div className="text-right shrink-0 bg-white/80 p-3 rounded-xl border border-red-200">
              <span className="text-xs text-red-800 font-semibold block">
                Total Potential Financial Loss:
              </span>
              <span className="text-xl font-black font-mono text-red-700 tabular-nums">
                {formatTk(totalQuarantineLoss)}
              </span>
            </div>
          </div>

          {/* Quarantine Items Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Damaged Product &amp; Lot No</TableHeaderCell>
                  <TableHeaderCell>Expiry Date</TableHeaderCell>
                  <TableHeaderCell>Supplier</TableHeaderCell>
                  <TableHeaderCell align="center">Damaged Quantity</TableHeaderCell>
                  <TableHeaderCell align="right">Purchase Cost</TableHeaderCell>
                  <TableHeaderCell align="right">Total Loss Value</TableHeaderCell>
                  <TableHeaderCell align="right">Action</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableLoadingState colSpan={7} text="Loading quarantine stock..." />
                ) : quarantineItems.length === 0 ? (
                  <TableEmptyState
                    colSpan={7}
                    icon={<CheckCircle2 className="w-8 h-8" />}
                    message="No damaged products in quarantine"
                    submessage="All dokan stock is healthy and sellable."
                  />
                ) : (
                  quarantineItems.map((item) => (
                    <TableRow key={item.lotId}>
                      <TableCell>
                        <div className="font-bold text-slate-900 text-sm">
                          {item.productNameEn}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <span>{item.productNameBn}</span>
                          <span className="font-mono text-red-700 font-bold">
                            Lot #{formatLotNumber(item.lotNumber)}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell isMonospace className="text-red-700 font-semibold">
                        {item.expiryDate}
                      </TableCell>

                      <TableCell className="text-xs text-slate-500">
                        {item.supplierName || "Agro Supplier"}
                      </TableCell>

                      <TableCell align="center">
                        <Badge variant="danger" size="md">
                          {item.quarantineQuantity} {item.baseUnit}
                        </Badge>
                      </TableCell>

                      <TableCell align="right" isMonospace>
                        {formatTk(item.purchaseCost)}
                      </TableCell>

                      <TableCell align="right" isMonospace className="text-red-700 font-black">
                        {formatTk(item.totalLossValue || item.quarantineQuantity * item.purchaseCost)}
                      </TableCell>

                      <TableCell align="right">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleOpenDisposalModal(item)}
                          leftIcon={<Flame className="w-3.5 h-3.5" />}
                          className="text-xs"
                        >
                          Dispose
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Quick Add Dokan Stock Modal */}
      {stockModalProduct && (
        <Modal
          isOpen={!!stockModalProduct}
          onClose={() => {
            setStockModalProduct(null)
            setAddStockQty("")
            setAddStockBuying("")
            setAddStockRetail("")
            setAddStockWholesale("")
            setAddStockLotNumber("")
            setAddStockExpiry("")
            setAddStockSupplier("")
            setAddStockChallan("")
          }}
          title={`Receive Stock: ${stockModalProduct.nameEn}`}
          subtitle="Create a priced lot for this stock entry"
          icon={<Package className="w-5 h-5 text-emerald-700" />}
          size="md"
        >
          <form onSubmit={handleAddStockSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="addStockQtyInput" className="block text-xs font-bold text-slate-900 mb-1">
                  Quantity ({stockModalProduct.baseUnit}) *
                </label>
                <Input
                  id="addStockQtyInput"
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  value={addStockQty}
                  onChange={(e) => setAddStockQty(e.target.value)}
                  placeholder="e.g. 50"
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="addStockLotInput" className="block text-xs font-bold text-slate-900 mb-1">
                  Lot / Batch No
                </label>
                <Input
                  id="addStockLotInput"
                  value={addStockLotNumber}
                  onChange={(e) => setAddStockLotNumber(e.target.value)}
                  placeholder="e.g. LOT-01"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="addStockBuyingInput" className="block text-xs font-bold text-slate-900 mb-1">
                  Purchase Cost
                </label>
                <Input
                  id="addStockBuyingInput"
                  type="number"
                  step="0.01"
                  min="0"
                  value={addStockBuying}
                  onChange={(e) => setAddStockBuying(e.target.value)}
                  placeholder={String(stockModalProduct.buyingPrice || "0.00")}
                />
              </div>

              <div>
                <label htmlFor="addStockRetailInput" className="block text-xs font-bold text-slate-900 mb-1">
                  Retail Price *
                </label>
                <Input
                  id="addStockRetailInput"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={addStockRetail}
                  onChange={(e) => setAddStockRetail(e.target.value)}
                  placeholder={String(stockModalProduct.retailPrice || "0.00")}
                />
              </div>

              <div>
                <label htmlFor="addStockWholesaleInput" className="block text-xs font-bold text-slate-900 mb-1">
                  Wholesale Price *
                </label>
                <Input
                  id="addStockWholesaleInput"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={addStockWholesale}
                  onChange={(e) => setAddStockWholesale(e.target.value)}
                  placeholder={String(stockModalProduct.wholesalePrice || stockModalProduct.retailPrice || "0.00")}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="addStockExpiryInput" className="block text-xs font-bold text-slate-900 mb-1">
                  Expiry Date
                </label>
                <Input
                  id="addStockExpiryInput"
                  type="date"
                  value={addStockExpiry}
                  onChange={(e) => setAddStockExpiry(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="addStockSupplierInput" className="block text-xs font-bold text-slate-900 mb-1">
                  Supplier
                </label>
                <Input
                  id="addStockSupplierInput"
                  value={addStockSupplier}
                  onChange={(e) => setAddStockSupplier(e.target.value)}
                  placeholder="Supplier name"
                />
              </div>

              <div>
                <label htmlFor="addStockChallanInput" className="block text-xs font-bold text-slate-900 mb-1">
                  Challan No
                </label>
                <Input
                  id="addStockChallanInput"
                  value={addStockChallan}
                  onChange={(e) => setAddStockChallan(e.target.value)}
                  placeholder="Auto generated"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => {
                  setStockModalProduct(null)
                  setAddStockQty("")
                  setAddStockBuying("")
                  setAddStockRetail("")
                  setAddStockWholesale("")
                  setAddStockLotNumber("")
                  setAddStockExpiry("")
                  setAddStockSupplier("")
                  setAddStockChallan("")
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isAddingStock}
                disabled={!addStockQty || parseFloat(addStockQty) <= 0}
              >
                Add Stock
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Floating Lot Selection Popover for Multi-Lot Products */}
      {lotDropdownProduct && (
        <>
          {/* Transparent backdrop to close dropdown on outside click */}
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onClick={() => setLotDropdownProduct(null)}
          />
          {/* Floating dropdown menu */}
          <div
            className="fixed z-50 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-1.5 animate-in fade-in zoom-in-95 duration-100 text-left overflow-hidden"
            style={{
              top:
                lotDropdownProduct.rect.top + 280 > window.innerHeight
                  ? undefined
                  : `${lotDropdownProduct.rect.top}px`,
              bottom:
                lotDropdownProduct.rect.top + 280 > window.innerHeight
                  ? `${window.innerHeight - lotDropdownProduct.rect.bottom}px`
                  : undefined,
              right: `${Math.max(16, lotDropdownProduct.rect.right)}px`,
            }}
          >
            <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-700" />
                <span>Select Lot for Sticker</span>
              </span>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                {lotDropdownProduct.lots.length} Lots Available
              </span>
            </div>

            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 no-scrollbar p-1">
              {lotDropdownProduct.lots.map((lot, idx) => {
                const lotQty = Number(lot.quantity ?? (lot as any).totalQuantity ?? 0)
                return (
                  <button
                    key={lot.lotId}
                    type="button"
                    onClick={() => {
                      setStickerItem(lot)
                      setStickerLots(lotDropdownProduct.lots)
                      setIsStickerOpen(true)
                      setLotDropdownProduct(null)
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
      )}

      {/* Barcode Sticker Modal */}
      {stickerItem && (
        <BarcodeStickerModal
          item={stickerItem}
          lots={stickerLots}
          onSelectLot={(lot) => setStickerItem(lot)}
          isOpen={isStickerOpen}
          onClose={() => {
            setIsStickerOpen(false)
            setStickerItem(null)
            setStickerLots([])
          }}
        />
      )}

      {/* Quarantine Disposal Confirmation Modal */}
      {selectedQuarantineItem && (
        <Modal
          isOpen={!!selectedQuarantineItem}
          onClose={() => setSelectedQuarantineItem(null)}
          title="Approve Damaged Chemical Disposal"
          subtitle="Permanently write off damaged stock from quarantine with owner approval"
          icon={<Flame className="w-5 h-5 text-red-600" />}
          size="md"
        >
          <div className="space-y-4">
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1">
              <div className="text-xs font-bold text-red-950">
                Product: {selectedQuarantineItem.productNameEn} (Lot #
                {formatLotNumber(selectedQuarantineItem.lotNumber)})
              </div>
              <div className="text-xs text-red-800 flex justify-between">
                <span>Current Quarantine Stock:</span>
                <span className="font-mono font-bold">
                  {selectedQuarantineItem.quarantineQuantity} {selectedQuarantineItem.baseUnit}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <Input
                label={`Disposal Quantity (${selectedQuarantineItem.baseUnit})`}
                type="number"
                step="any"
                max={selectedQuarantineItem.quarantineQuantity}
                value={disposalQty}
                onChange={(e) => setDisposalQty(e.target.value)}
                placeholder="Quantity"
                required
              />

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  Disposal Type / Reason:
                </label>
                <select
                  value={disposalType}
                  onChange={(e) => setDisposalType(e.target.value)}
                  className="w-full text-xs py-2 px-3 bg-white border border-slate-200 rounded-xl focus:border-red-600 focus:outline-hidden"
                >
                  <option value="WRITE_OFF">Permanent Write-Off (Damaged)</option>
                  <option value="SUPPLIER_CLAIM">Return to Supplier / Claim</option>
                  <option value="DESTROYED">Disposed / Destroyed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  Remarks (optional):
                </label>
                <textarea
                  value={disposalRemarks}
                  onChange={(e) => setDisposalRemarks(e.target.value)}
                  rows={2}
                  placeholder="e.g. Disposed of due to expiry or bottle leakage..."
                  className="w-full text-xs py-2 px-3 bg-white border border-slate-200 rounded-xl focus:border-red-600 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200/60">
              <Button
                variant="ghost"
                size="md"
                onClick={() => setSelectedQuarantineItem(null)}
                disabled={isDisposing}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="md"
                onClick={handleExecuteDisposal}
                isLoading={isDisposing}
                leftIcon={<Check className="w-4 h-4" />}
              >
                Confirm Disposal
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── Bin Card (Stock Movement Ledger) Modal ─────────────── */}
      <StockLedgerModal
        isOpen={showLedgerModal}
        productId={selectedLedgerProduct?.id}
        productName={selectedLedgerProduct?.nameEn}
        productCode={selectedLedgerProduct?.productCode}
        lotId={selectedLedgerLot?.id}
        lotNumber={selectedLedgerLot?.lotNumber}
        onClose={() => setShowLedgerModal(false)}
      />

      {/* ─── Stock Adjustment & Damage Write-Off Modal ─────────── */}
      <StockAdjustmentModal
        isOpen={showStockAdjustmentModal}
        products={products}
        lots={inventoryLots}
        initialProductId={adjustmentInitialProduct}
        initialLotId={adjustmentInitialLot}
        onClose={() => setShowStockAdjustmentModal(false)}
        onSuccess={handleAdjustmentSuccess}
      />
    </div>
  )
}
