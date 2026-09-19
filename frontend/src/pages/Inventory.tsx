import { Fragment, useState, useEffect, useMemo, useCallback } from "react"
import type {
  Product,
  StockItem,
  QuarantineStockItem,
  QuarantineDisposalRequest,
} from "../types"
import {
  getStock,
  getProducts,
  createProduct,
  createLot,
  getQuarantineStock,
  disposeQuarantineStock,
} from "../api/endpoints"
import { useToast } from "../context/ToastContext"
import { formatTk } from "../utils/currency"
import BarcodeStickerModal from "../components/BarcodeStickerModal"
import Button from "../components/ui/Button"
import Input from "../components/ui/Input"
import Badge from "../components/ui/Badge"
import StatCard from "../components/ui/StatCard"
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
} from "lucide-react"

export default function Inventory() {
  const { showSuccess, showError, showWarning } = useToast()

  const [activeTab, setActiveTab] = useState<"catalog" | "quarantine">("catalog")

  // ─── Remote Data State ──────────────────────────────────────────
  const [stocks, setStocks] = useState<StockItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [quarantineItems, setQuarantineItems] = useState<QuarantineStockItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // ─── Filters & Search ───────────────────────────────────────────
  const [search, setSearch] = useState<string>("")
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL")
  const [onlyLowStock, setOnlyLowStock] = useState<boolean>(false)

  // ─── Modals State ───────────────────────────────────────────────
  const [stickerItem, setStickerItem] = useState<StockItem | null>(null)
  const [isStickerOpen, setIsStickerOpen] = useState<boolean>(false)
  const [showAddProduct, setShowAddProduct] = useState<boolean>(false)

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

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return groupedProducts.filter((item) => {
      if (selectedCategory !== "ALL" && item.category !== selectedCategory) {
        return false
      }

      if (onlyLowStock && item.totalStock > item.minStockAlert) {
        return false
      }

      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const matchCode = item.productCode.toLowerCase().includes(q)
        const matchEn = item.nameEn.toLowerCase().includes(q)
        const matchBn = item.nameBn.includes(search.trim())
        const matchLot = item.lots.some(
          (l) =>
            (l as any).lotNumber?.toLowerCase().includes(q) ||
            (l as any).barcode?.toLowerCase().includes(q),
        )
        if (!matchCode && !matchEn && !matchBn && !matchLot) {
          return false
        }
      }

      return true
    })
  }, [groupedProducts, selectedCategory, onlyLowStock, search])

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

  const totalQuarantineLoss = useMemo(() => {
    return quarantineItems.reduce(
      (sum, item) => sum + (item.totalLossValue || item.quarantineQuantity * item.purchaseCost),
      0,
    )
  }, [quarantineItems])

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
          lotNumber: `STOCK-${Date.now().toString().slice(-6)}`,
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

      const lotNumber = addStockLotNumber.trim() || `LOT-${Date.now().toString().slice(-6)}`
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
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowAddProduct((p) => !p)}
              leftIcon={showAddProduct ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            >
              {showAddProduct ? "Close Form" : "New Product"}
            </Button>
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
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              title="Registered Products (SKUs)"
              value={`${products.length}`}
              icon={<Sprout className="w-5 h-5" />}
              color="emerald"
            />
            <StatCard
              title="Total Dokan Stock"
              value={`${totalStockUnits.toLocaleString("en-US")} units`}
              icon={<Package className="w-5 h-5" />}
              color="blue"
            />
            <StatCard
              title="Low Stock Alerts"
              value={`${lowStockCount}`}
              icon={<AlertTriangle className="w-5 h-5" />}
              color="amber"
              trend={
                lowStockCount > 0
                  ? { value: `${lowStockCount} alert(s)`, isPositive: false }
                  : undefined
              }
            />
            <StatCard
              title="Inventory Valuation (Cost)"
              value={formatTk(totalValuation)}
              icon={<Wallet className="w-5 h-5" />}
              color="purple"
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
              <button
                type="button"
                onClick={() => setSelectedCategory("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  selectedCategory === "ALL"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-50 text-slate-900 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                All ({products.length})
              </button>
              {categories.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap ${
                    selectedCategory === cat
                      ? "bg-emerald-700 text-white"
                      : "bg-slate-50 text-slate-900 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  {cat}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setOnlyLowStock((prev) => !prev)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap border flex items-center gap-1 ${
                  onlyLowStock
                    ? "bg-amber-100 text-amber-900 border-amber-300"
                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Low Stock</span>
              </button>
            </div>
          </div>

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
                    message="No products found"
                    submessage="Reset the filters or add a new product"
                  />
                ) : (
                  filteredProducts.map((item) => {
                    const isLowStock = item.totalStock <= item.minStockAlert

                    return (
                      <TableRow key={item.productId} className={isLowStock ? "bg-amber-50/30" : ""}>
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
                          <div className="flex flex-col items-center gap-2">
                            <Badge
                              variant={
                                item.totalStock <= 0
                                  ? "danger"
                                  : isLowStock
                                    ? "warning"
                                    : "success"
                              }
                              size="md"
                              dot={isLowStock || item.totalStock <= 0}
                            >
                              {item.totalStock} {item.baseUnit}
                            </Badge>
                            {item.lots.length > 0 && (
                              <div className="w-full min-w-[280px] overflow-hidden rounded-lg border border-slate-200 bg-white text-left shadow-xs">
                                <div className="grid grid-cols-[minmax(0,1.1fr)_56px_76px_72px] gap-2 border-b border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] font-bold uppercase text-slate-500">
                                  <span>Lot</span>
                                  <span className="text-right">Qty</span>
                                  <span className="text-right">Price</span>
                                  <span className="text-right">Expiry</span>
                                </div>
                                {[...item.lots]
                                  .sort(
                                    (a, b) =>
                                      new Date(a.expiryDate || 0).getTime() -
                                      new Date(b.expiryDate || 0).getTime(),
                                  )
                                  .map((lot) => (
                                    <div
                                      key={lot.lotId}
                                      className="grid grid-cols-[minmax(0,1.1fr)_56px_76px_72px] gap-2 border-b border-slate-100 px-2.5 py-2 last:border-b-0"
                                    >
                                      <div className="min-w-0">
                                        <div className="truncate font-mono text-[11px] font-black text-slate-900">
                                          {lot.lotNumber || "DEFAULT"}
                                        </div>
                                        <div className="truncate text-[10px] text-slate-500">
                                          {lot.lotBarcode || lot.barcode || lot.defaultBarcode}
                                        </div>
                                      </div>
                                      <div className="self-center text-right font-mono text-[12px] font-black text-emerald-800">
                                        {lot.quantity ?? lot.totalQuantity ?? 0}
                                      </div>
                                      <div className="self-center text-right font-mono text-[11px] font-bold text-slate-900">
                                        {formatTk(lot.lotRetailPrice ?? item.retailPrice)}
                                      </div>
                                      <div className="self-center text-right font-mono text-[10px] font-semibold text-slate-500">
                                        {lot.expiryDate || "Not set"}
                                      </div>
                                    </div>
                                  ))}
                              </div>
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
                              onClick={() => {
                                const latestLot = [...item.lots].sort(
                                  (a, b) =>
                                    new Date(b.entryDate || 0).getTime() -
                                    new Date(a.entryDate || 0).getTime(),
                                )[0]
                                const retailPrice = latestLot?.lotRetailPrice ?? item.retailPrice
                                const wholesalePrice =
                                  latestLot?.lotWholesalePrice ?? item.wholesalePrice
                                const buyingPrice = latestLot?.purchaseCost ?? item.buyingPrice

                                setStockModalProduct({
                                  productId: item.productId,
                                  nameEn: item.nameEn,
                                  baseUnit: item.baseUnit,
                                  retailPrice,
                                  wholesalePrice,
                                  buyingPrice,
                                })
                                setAddStockQty("")
                                setAddStockBuying(String(buyingPrice || ""))
                                setAddStockRetail(String(retailPrice || ""))
                                setAddStockWholesale(String(wholesalePrice || retailPrice || ""))
                                setAddStockLotNumber("")
                                setAddStockExpiry("")
                                setAddStockSupplier((latestLot as any)?.supplierName || "")
                                setAddStockChallan("")
                              }}
                              title="Add stock to this product"
                              leftIcon={<Plus className="w-3.5 h-3.5" />}
                              className="text-xs px-2 py-1 bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                            >
                              + Stock
                            </Button>
                            {item.lots.length > 0 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setStickerItem(item.lots[0])
                                  setIsStickerOpen(true)
                                }}
                                title="Print barcode label sticker"
                                leftIcon={<Tag className="w-3.5 h-3.5" />}
                                className="text-xs px-2 py-1"
                              >
                                Sticker
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
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
                            Lot #{item.lotNumber}
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
                  placeholder="Auto generated"
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

      {/* Barcode Sticker Modal */}
      {stickerItem && (
        <BarcodeStickerModal
          item={stickerItem}
          isOpen={isStickerOpen}
          onClose={() => {
            setIsStickerOpen(false)
            setStickerItem(null)
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
                {selectedQuarantineItem.lotNumber})
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
    </div>
  )
}
