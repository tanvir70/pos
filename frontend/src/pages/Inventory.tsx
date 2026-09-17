import { useState, useEffect, useMemo, useCallback } from "react"
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
  getQuarantineStock,
  disposeQuarantineStock,
} from "../api/endpoints"
import { useAuth } from "../context/AuthContext"
import { useToast } from "../context/ToastContext"
import { formatTk } from "../utils/currency"
import BarcodeStickerModal from "../components/BarcodeStickerModal"
import LotEntryModal from "../components/LotEntryModal"
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

export interface InventoryProps {
  isOwner?: boolean
}

export default function Inventory({ isOwner: propIsOwner }: InventoryProps) {
  const { isOwner: authIsOwner, openPinModal } = useAuth()
  const { showSuccess, showError, showWarning } = useToast()
  const isOwner = propIsOwner !== undefined ? propIsOwner : authIsOwner

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

  // Expanded lots accordion state (keyed by productId)
  const [expandedProductIds, setExpandedProductIds] = useState<Set<number>>(new Set())

  // ─── Modals State ───────────────────────────────────────────────
  const [isLotEntryOpen, setIsLotEntryOpen] = useState<boolean>(false)
  const [stickerItem, setStickerItem] = useState<StockItem | null>(null)
  const [isStickerOpen, setIsStickerOpen] = useState<boolean>(false)
  const [showAddProduct, setShowAddProduct] = useState<boolean>(false)

  // Quarantine Disposal Modal State
  const [selectedQuarantineItem, setSelectedQuarantineItem] =
    useState<QuarantineStockItem | null>(null)
  const [disposalQty, setDisposalQty] = useState<string>("")
  const [disposalType, setDisposalType] = useState<string>("WRITE_OFF")
  const [disposalRemarks, setDisposalRemarks] = useState<string>("")
  const [isDisposing, setIsDisposing] = useState<boolean>(false)

  // ─── New Product Form State ─────────────────────────────────────
  const [newProdNameBn, setNewProdNameBn] = useState("")
  const [newProdNameEn, setNewProdNameEn] = useState("")
  const [newProdCode, setNewProdCode] = useState("")
  const [newProdCategory, setNewProdCategory] = useState("কীটনাশক (Insecticide)")
  const [newProdBaseUnit, setNewProdBaseUnit] = useState("বোতল (Bottle)")
  const [newProdCartonMult, setNewProdCartonMult] = useState("20")
  const [newProdRetail, setNewProdRetail] = useState("")
  const [newProdWholesale, setNewProdWholesale] = useState("")
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
      showError(err, "ইনভেন্টরি তথ্য লোড ব্যর্থ")
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
        cartonMultiplier: prod.cartonMultiplier,
        minStockAlert: prod.minStockAlert,
        retailPrice: prod.standardRetailPrice,
        wholesalePrice: prod.standardWholesalePrice,
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
          cartonMultiplier: stock.cartonMultiplier,
          minStockAlert: 5,
          retailPrice: (stock as any).lotRetailPrice || stock.standardRetailPrice || 0,
          wholesalePrice: (stock as any).lotWholesalePrice || stock.standardWholesalePrice || 0,
          totalStock: 0,
          lots: [],
        }
        map.set(pId, entry)
      }
      entry.totalStock += Number(stock.quantity ?? (stock as any).totalQuantity) || 0
      entry.lots.push(stock)
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

  const toggleExpand = (productId: number) => {
    setExpandedProductIds((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) {
        next.delete(productId)
      } else {
        next.add(productId)
      }
      return next
    })
  }

  // ─── Create Product Handler ──────────────────────────────────────
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProdNameBn.trim() || !newProdNameEn.trim()) {
      showWarning("পণ্যের বাংলা ও ইংরেজি নাম আবশ্যক!")
      return
    }

    try {
      setIsSavingProd(true)
      const code =
        newProdCode.trim() ||
        `SYN-${newProdNameEn.replace(/\s+/g, "-").toUpperCase().slice(0, 6)}`

      await createProduct({
        productCode: code,
        nameEn: newProdNameEn.trim(),
        nameBn: newProdNameBn.trim(),
        companyName: "Agro Chem",
        category: newProdCategory,
        baseUnit: newProdBaseUnit,
        cartonMultiplier: parseFloat(newProdCartonMult) || 20,
        standardRetailPrice: parseFloat(newProdRetail) || 0,
        standardWholesalePrice: parseFloat(newProdWholesale) || 0,
        minStockAlert: parseInt(newProdMinStock) || 5,
        defaultBarcode: `${code}-DEF`,
      })

      setShowAddProduct(false)
      setNewProdNameBn("")
      setNewProdNameEn("")
      setNewProdCode("")
      setNewProdRetail("")
      setNewProdWholesale("")
      showSuccess("নতুন পণ্য সফলভাবে ক্যাটালগে যুক্ত হয়েছে!")
      await loadData()
    } catch (err) {
      showError(err, "পণ্য তৈরি ব্যর্থ")
    } finally {
      setIsSavingProd(false)
    }
  }

  // ─── Quarantine Disposal Execution ──────────────────────────────
  const handleOpenDisposalModal = (item: QuarantineStockItem) => {
    if (!isOwner) {
      showWarning("ড্যামেজ কেমিক্যাল বিনষ্টকরণের জন্য মালিক মোড আবশ্যক!")
      openPinModal()
      return
    }
    setSelectedQuarantineItem(item)
    setDisposalQty(String(item.quarantineQuantity))
    setDisposalType("WRITE_OFF")
    setDisposalRemarks("")
  }

  const handleExecuteDisposal = async () => {
    if (!selectedQuarantineItem) return
    const qty = parseFloat(disposalQty)
    if (isNaN(qty) || qty <= 0) {
      showWarning("সঠিক পরিমাণ লিখুন")
      return
    }
    if (qty > selectedQuarantineItem.quarantineQuantity) {
      showWarning("কোয়ারেন্টাইনে থাকা পরিমাণের চেয়ে বেশি বিনষ্ট করা যাবে না!")
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
        `লট #${selectedQuarantineItem.lotNumber} থেকে ${qty} ইউনিট ড্যামেজ কেমিক্যাল সফলভাবে বিনষ্ট/ডিসপোজ করা হয়েছে!`,
      )
      setSelectedQuarantineItem(null)
      await loadData()
    } catch (err) {
      showError(err, "ডিসপোজাল ব্যর্থ")
    } finally {
      setIsDisposing(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Banner & Tab Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-frost-border shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-frost-dark bn-text flex items-center gap-2">
            <span>📦</span>
            <span>ইনভেন্টরি ও দোকান স্টক ম্যানেজমেন্ট</span>
          </h1>
          <p className="text-xs text-frost-muted mt-0.5 bn-text">
            দোকানের রিয়েল-টাইম স্টক, লট চালান এন্ট্রি, বারকোড স্টিকার এবং ড্যামেজ কেমিক্যাল কোয়ারেন্টাইন
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Tab Switcher */}
          <div className="inline-flex bg-frost-surface p-0.5 rounded-xl border border-frost-border">
            <button
              type="button"
              onClick={() => setActiveTab("catalog")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer bn-text ${
                activeTab === "catalog"
                  ? "bg-white text-emerald-800 shadow-xs border border-frost-border/60"
                  : "text-frost-muted hover:text-frost-dark"
              }`}
            >
              দোকান স্টক ({stocks.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("quarantine")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer bn-text flex items-center gap-1.5 ${
                activeTab === "quarantine"
                  ? "bg-rose-700 text-white shadow-xs"
                  : "text-rose-700 hover:bg-rose-50"
              }`}
            >
              <span>☣️ কোয়ারেন্টাইন</span>
              {quarantineItems.length > 0 && (
                <span className="bg-rose-900 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                  {quarantineItems.length}
                </span>
              )}
            </button>
          </div>

          {activeTab === "catalog" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddProduct((p) => !p)}
                className="bn-text"
              >
                {showAddProduct ? "✕ ফর্ম বন্ধ" : "+ নতুন পণ্য"}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsLotEntryOpen(true)}
                leftIcon={<span>📥</span>}
                className="bn-text"
              >
                নতুন চালান এন্ট্রি
              </Button>
            </>
          )}

          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="p-2 bg-frost-surface hover:bg-frost-hover text-frost-dark rounded-xl border border-frost-border cursor-pointer transition-colors text-xs"
            title="রিফ্রেশ"
          >
            <span className={isLoading ? "animate-spin inline-block" : ""}>🔄</span>
          </button>
        </div>
      </div>

      {/* ─── TAB 1: CATALOG & DOKAN STOCK ────────────────────────── */}
      {activeTab === "catalog" && (
        <>
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              title="নিবন্ধিত পণ্য (SKUs)"
              value={`${products.length} টি`}
              icon="🌾"
              colorTheme="emerald"
            />
            <StatCard
              title="মোট দোকান স্টক"
              value={`${totalStockUnits.toLocaleString("en-IN")} ইউনিট`}
              icon="📦"
              colorTheme="blue"
            />
            <StatCard
              title="কম স্টক সতর্কতা"
              value={`${lowStockCount} টি`}
              icon="⚠️"
              colorTheme="amber"
              trend={
                lowStockCount > 0
                  ? { value: `${lowStockCount} টি সতর্কবার্তা`, isPositive: false }
                  : undefined
              }
            />
            <StatCard
              title="ইনভেন্টরি মূল্যায়ন (কেনা দাম)"
              value={formatTk(totalValuation)}
              icon="💰"
              colorTheme="purple"
              isMasked={!isOwner}
              onUnlockClick={openPinModal}
            />
          </div>

          {/* New Product Inline Card */}
          {showAddProduct && (
            <div className="bg-white p-5 rounded-2xl border-2 border-emerald-500 shadow-md animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-frost-border/60 mb-4">
                <h3 className="font-bold text-base text-frost-dark bn-text flex items-center gap-2">
                  <span>➕</span>
                  <span>নতুন পণ্য মাস্টার ক্যাটালগে যুক্ত করুন</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddProduct(false)}
                  className="text-frost-muted hover:text-frost-dark text-sm p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateProduct} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    label="পণ্যের বাংলা নাম"
                    required
                    value={newProdNameBn}
                    onChange={(e) => setNewProdNameBn(e.target.value)}
                    placeholder="যেমন: ভিরতাকো ৪০ ডব্লিউজি"
                  />
                  <Input
                    label="English Name"
                    required
                    value={newProdNameEn}
                    onChange={(e) => setNewProdNameEn(e.target.value)}
                    placeholder="e.g. Virtako 40WG"
                  />
                  <Input
                    label="প্রোডাক্ট কোড (ঐচ্ছিক)"
                    value={newProdCode}
                    onChange={(e) => setNewProdCode(e.target.value)}
                    placeholder="যেমন: SYN-VIRT-100"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-frost-dark bn-text mb-1">
                      ক্যাটাগরি
                    </label>
                    <select
                      value={newProdCategory}
                      onChange={(e) => setNewProdCategory(e.target.value)}
                      className="w-full text-xs py-2 px-3 bg-white border border-frost-border rounded-xl focus:border-emerald-600 focus:outline-hidden bn-text"
                    >
                      <option value="কীটনাশক (Insecticide)">কীটনাশক (Insecticide)</option>
                      <option value="ছত্রাকনাশক (Fungicide)">ছত্রাকনাশক (Fungicide)</option>
                      <option value="আগাছানাশক (Herbicide)">আগাছানাশক (Herbicide)</option>
                      <option value="গ্রোথ প্রমোটার (Bio-stimulant)">গ্রোথ প্রমোটার</option>
                      <option value="বীজ (Seed)">বীজ (Seed)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-frost-dark bn-text mb-1">
                      প্যাকেজিং ইউনিট
                    </label>
                    <select
                      value={newProdBaseUnit}
                      onChange={(e) => setNewProdBaseUnit(e.target.value)}
                      className="w-full text-xs py-2 px-3 bg-white border border-frost-border rounded-xl focus:border-emerald-600 focus:outline-hidden bn-text"
                    >
                      <option value="বোতল (Bottle)">বোতল (Bottle)</option>
                      <option value="প্যাকেট (Packet)">প্যাকেট (Packet)</option>
                      <option value="কেজি (Kg)">কেজি (Kg)</option>
                      <option value="লিটার (Liter)">লিটার (Liter)</option>
                      <option value="পিস (Piece)">পিস (Piece)</option>
                    </select>
                  </div>

                  <Input
                    label="কার্টন গুণক (Carton Mult)"
                    type="number"
                    value={newProdCartonMult}
                    onChange={(e) => setNewProdCartonMult(e.target.value)}
                    placeholder="20"
                    helperText="১ কার্টনে কয়টি ইউনিট থাকে"
                  />

                  <Input
                    label="কম স্টক সতর্কতা সীমা"
                    type="number"
                    value={newProdMinStock}
                    onChange={(e) => setNewProdMinStock(e.target.value)}
                    placeholder="5"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="স্ট্যান্ডার্ড খুচরা দর (৳)"
                    type="number"
                    value={newProdRetail}
                    onChange={(e) => setNewProdRetail(e.target.value)}
                    placeholder="0.00"
                  />
                  <Input
                    label="স্ট্যান্ডার্ড পাইকারি দর (৳)"
                    type="number"
                    value={newProdWholesale}
                    onChange={(e) => setNewProdWholesale(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    onClick={() => setShowAddProduct(false)}
                  >
                    বাতিল
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={isSavingProd}
                  >
                    সংরক্ষণ করুন
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Search & Category Filter Bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-frost-border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1 max-w-md">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClear={() => setSearch("")}
                placeholder="পণ্য, কোড বা লট নম্বর দিয়ে খুঁজুন..."
                leftAdornment={<span className="text-frost-muted">🔍</span>}
                inputSize="sm"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedCategory("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer bn-text ${
                  selectedCategory === "ALL"
                    ? "bg-frost-dark text-white"
                    : "bg-frost-surface text-frost-dark hover:bg-frost-hover border border-frost-border"
                }`}
              >
                সব ({products.length})
              </button>
              {categories.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap bn-text ${
                    selectedCategory === cat
                      ? "bg-emerald-700 text-white"
                      : "bg-frost-surface text-frost-dark hover:bg-frost-hover border border-frost-border"
                  }`}
                >
                  {cat}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setOnlyLowStock((prev) => !prev)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap bn-text border ${
                  onlyLowStock
                    ? "bg-amber-100 text-amber-900 border-amber-300"
                    : "bg-white text-frost-muted border-frost-border hover:bg-frost-surface"
                }`}
              >
                ⚠️ কম স্টক
              </button>
            </div>
          </div>

          {/* Dokan Stock Inventory Table */}
          <div className="bg-white rounded-2xl border border-frost-border shadow-xs overflow-hidden">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>পণ্য বিবরণ ও কোড</TableHeaderCell>
                  <TableHeaderCell>ক্যাটাগরি</TableHeaderCell>
                  <TableHeaderCell>প্যাকেজিং / কার্টন</TableHeaderCell>
                  <TableHeaderCell align="center">দোকান মজুদ (Dokan Stock)</TableHeaderCell>
                  <TableHeaderCell align="right">খুচরা দর</TableHeaderCell>
                  <TableHeaderCell align="right">পাইকারি দর</TableHeaderCell>
                  {isOwner && <TableHeaderCell align="right">কেনা দাম</TableHeaderCell>}
                  <TableHeaderCell align="right">অ্যাকশন</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableLoadingState colSpan={isOwner ? 8 : 7} text="স্টক তালিকা লোড হচ্ছে..." />
                ) : filteredProducts.length === 0 ? (
                  <TableEmptyState
                    colSpan={isOwner ? 8 : 7}
                    icon="📦"
                    message="কোনো পণ্য পাওয়া যায়নি"
                    submessage="ফিল্টার রিসেট করুন অথবা নতুন লট এন্ট্রি করুন"
                  />
                ) : (
                  filteredProducts.map((item) => {
                    const isExpanded = expandedProductIds.has(item.productId)
                    const isLowStock = item.totalStock <= item.minStockAlert

                    return (
                      <React.Fragment key={item.productId}>
                        <TableRow className={isLowStock ? "bg-amber-50/30" : ""}>
                          {/* Product Info */}
                          <TableCell>
                            <div>
                              <div className="font-bold text-frost-dark bn-text text-sm">
                                {item.nameBn}
                              </div>
                              <div className="text-[11px] text-frost-muted flex items-center gap-2">
                                <span>{item.nameEn}</span>
                                <span className="font-mono text-emerald-800 font-semibold">
                                  #{item.productCode}
                                </span>
                              </div>
                            </div>
                          </TableCell>

                          {/* Category */}
                          <TableCell>
                            <span className="text-xs px-2 py-0.5 rounded-lg bg-frost-surface font-semibold text-frost-dark border border-frost-border bn-text">
                              {item.category}
                            </span>
                          </TableCell>

                          {/* Packaging */}
                          <TableCell>
                            <div className="text-xs font-medium text-frost-dark bn-text">
                              {item.baseUnit}
                            </div>
                            <div className="text-[10px] text-frost-muted font-mono">
                              ১ কার্টন = {item.cartonMultiplier} {item.baseUnit}
                            </div>
                          </TableCell>

                          {/* Dokan Stock */}
                          <TableCell align="center">
                            <div className="inline-flex flex-col items-center">
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
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(item.productId)}
                                  className="text-[10px] font-bold text-emerald-800 hover:underline mt-1 cursor-pointer bn-text"
                                >
                                  {isExpanded ? "▲ লট লুকান" : `▼ ${item.lots.length} টি লট দেখুন`}
                                </button>
                              )}
                            </div>
                          </TableCell>

                          {/* Retail Price */}
                          <TableCell align="right" isMonospace>
                            {formatTk(item.retailPrice)}
                          </TableCell>

                          {/* Wholesale Price */}
                          <TableCell align="right" isMonospace>
                            {formatTk(item.wholesalePrice)}
                          </TableCell>

                          {/* Purchase Cost (Owner Only) */}
                          {isOwner && (
                            <TableCell align="right" isMonospace className="text-amber-800">
                              {item.lots.length > 0
                                ? formatTk((item.lots[0] as any).purchaseCost || 0)
                                : "—"}
                            </TableCell>
                          )}

                          {/* Actions */}
                          <TableCell align="right">
                            <div className="flex items-center justify-end gap-1.5">
                              {item.lots.length > 0 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setStickerItem(item.lots[0])
                                    setIsStickerOpen(true)
                                  }}
                                  title="বারকোড লেবেল স্টিকার প্রিন্ট করুন"
                                  className="text-xs px-2 py-1"
                                >
                                  🏷️ স্টিকার
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Expanded Lots Accordion */}
                        {isExpanded && item.lots.length > 0 && (
                          <TableRow className="bg-emerald-50/20">
                            <td colSpan={isOwner ? 8 : 7} className="p-3">
                              <div className="bg-white rounded-xl border border-emerald-200 p-3 shadow-xs space-y-2">
                                <div className="text-xs font-bold text-emerald-900 bn-text flex items-center justify-between">
                                  <span>লট ও ব্যাচ ট্র্যাকিং তালিকা (FEFO):</span>
                                  <span className="font-normal text-frost-muted">
                                    মোট লট: {item.lots.length} টি
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                  {item.lots.map((lot) => (
                                    <div
                                      key={lot.lotId}
                                      className="p-2.5 bg-frost-surface/40 border border-frost-border rounded-lg text-xs space-y-1"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-mono font-bold text-frost-dark">
                                          #{lot.lotNumber}
                                        </span>
                                        <Badge variant="neutral" size="sm">
                                          {lot.quantity} {item.baseUnit}
                                        </Badge>
                                      </div>
                                      <div className="text-[11px] text-frost-muted flex justify-between">
                                        <span>মেয়াদ:</span>
                                        <span className="font-mono font-bold text-frost-dark">
                                          {lot.expiryDate}
                                        </span>
                                      </div>
                                      {lot.barcode && (
                                        <div className="text-[10px] text-frost-muted font-mono truncate">
                                          BC: {lot.barcode}
                                        </div>
                                      )}
                                      <div className="pt-1 flex justify-end">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setStickerItem(lot)
                                            setIsStickerOpen(true)
                                          }}
                                          className="text-[10px] font-bold text-emerald-800 hover:underline cursor-pointer bn-text"
                                        >
                                          🏷️ এই লটের স্টিকার
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </TableRow>
                        )}
                      </React.Fragment>
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
          <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="text-3xl">☣️</span>
              <div>
                <h3 className="font-bold text-base text-rose-950 bn-text">
                  ড্যামেজ ও কোয়ারেন্টাইন কেমিক্যাল আইসোলেশন
                </h3>
                <p className="text-xs text-rose-800 bn-text mt-0.5">
                  মেয়াদোত্তীর্ণ বা ক্ষতিগ্রস্ত রাসায়নিক দ্রব্যাদি আলাদাভাবে সংরক্ষিত থাকে, যা বিক্রির মূল স্টক থেকে পৃথক।
                </p>
              </div>
            </div>

            <div className="text-right shrink-0 bg-white/80 p-3 rounded-xl border border-rose-200">
              <span className="text-xs text-rose-800 font-semibold bn-text block">
                মোট সম্ভাব্য আর্থিক ক্ষতি:
              </span>
              <span className="text-xl font-black font-mono text-rose-700">
                {formatTk(totalQuarantineLoss)}
              </span>
            </div>
          </div>

          {/* Quarantine Items Table */}
          <div className="bg-white rounded-2xl border border-frost-border shadow-xs overflow-hidden">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>ক্ষতিগ্রস্ত পণ্য ও লট নম্বর</TableHeaderCell>
                  <TableHeaderCell>মেয়াদ শেষ তারিখ</TableHeaderCell>
                  <TableHeaderCell>সরবরাহকারী (Supplier)</TableHeaderCell>
                  <TableHeaderCell align="center">ড্যামেজ পরিমাণ</TableHeaderCell>
                  <TableHeaderCell align="right">কেনা দাম</TableHeaderCell>
                  <TableHeaderCell align="right">মোট ক্ষতি (Loss Value)</TableHeaderCell>
                  <TableHeaderCell align="right">ব্যবস্থা গ্রহণ</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableLoadingState colSpan={7} text="কোয়ারেন্টাইন স্টক লোড হচ্ছে..." />
                ) : quarantineItems.length === 0 ? (
                  <TableEmptyState
                    colSpan={7}
                    icon="✅"
                    message="কোয়ারেন্টাইনে কোনো ক্ষতিগ্রস্ত পণ্য নেই"
                    submessage="দোকানের সমস্ত স্টক স্বাস্থ্যকর ও বিক্রয়যোগ্য অবস্থায় রয়েছে।"
                  />
                ) : (
                  quarantineItems.map((item) => (
                    <TableRow key={item.lotId}>
                      <TableCell>
                        <div className="font-bold text-frost-dark bn-text text-sm">
                          {item.productNameBn}
                        </div>
                        <div className="text-[11px] text-frost-muted flex items-center gap-2">
                          <span>{item.productNameEn}</span>
                          <span className="font-mono text-rose-700 font-bold">
                            লট #{item.lotNumber}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell isMonospace className="text-rose-700 font-semibold">
                        {item.expiryDate}
                      </TableCell>

                      <TableCell className="bn-text text-xs text-frost-muted">
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

                      <TableCell align="right" isMonospace className="text-rose-700 font-black">
                        {formatTk(item.totalLossValue || item.quarantineQuantity * item.purchaseCost)}
                      </TableCell>

                      <TableCell align="right">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleOpenDisposalModal(item)}
                          className="bn-text text-xs"
                        >
                          🔥 বিনষ্টকরণ (Dispose)
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

      {/* Lot Entry Modal */}
      <LotEntryModal
        products={products}
        isOpen={isLotEntryOpen}
        onClose={() => setIsLotEntryOpen(false)}
        onSuccess={() => {
          showSuccess("নতুন চালান ও লট সফলভাবে যুক্ত হয়েছে!")
          loadData()
        }}
      />

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
          title="ড্যামেজ কেমিক্যাল বিনষ্টকরণ অনুমোদন (Disposal)"
          subtitle="মালিকের অনুমোদনক্রমে নষ্ট কেমিক্যাল স্টক থেকে স্থায়ীভাবে রাইট-অফ করুন"
          icon="🔥"
          size="md"
        >
          <div className="space-y-4">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
              <div className="text-xs font-bold text-rose-950 bn-text">
                পণ্য: {selectedQuarantineItem.productNameBn} (লট #{selectedQuarantineItem.lotNumber})
              </div>
              <div className="text-xs text-rose-800 flex justify-between">
                <span>বর্তমান কোয়ারেন্টাইন মজুদ:</span>
                <span className="font-mono font-bold">
                  {selectedQuarantineItem.quarantineQuantity} {selectedQuarantineItem.baseUnit}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <Input
                label={`বিনষ্টকরণের পরিমাণ (${selectedQuarantineItem.baseUnit})`}
                type="number"
                step="any"
                max={selectedQuarantineItem.quarantineQuantity}
                value={disposalQty}
                onChange={(e) => setDisposalQty(e.target.value)}
                placeholder="পরিমাণ"
                required
              />

              <div>
                <label className="block text-xs font-bold text-frost-dark bn-text mb-1">
                  বিনষ্টকরণের ধরন / কারণ:
                </label>
                <select
                  value={disposalType}
                  onChange={(e) => setDisposalType(e.target.value)}
                  className="w-full text-xs py-2 px-3 bg-white border border-frost-border rounded-xl focus:border-rose-600 focus:outline-hidden bn-text"
                >
                  <option value="WRITE_OFF">স্থায়ী ক্ষতি রাইট-অফ (Damaged Write-Off)</option>
                  <option value="SUPPLIER_CLAIM">কোম্পানিকে ফেরত / ক্লেইম (Supplier Return Claim)</option>
                  <option value="DESTROYED">পরিবেশসম্মত বিনষ্টকরণ (Disposed / Destroyed)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-frost-dark bn-text mb-1">
                  মন্তব্য / বিবরণ (ঐচ্ছিক):
                </label>
                <textarea
                  value={disposalRemarks}
                  onChange={(e) => setDisposalRemarks(e.target.value)}
                  rows={2}
                  placeholder="যেমন: মেয়াদোত্তীর্ণ হওয়ায় বা বোতল লিক করায় বিনষ্ট করা হলো..."
                  className="w-full text-xs py-2 px-3 bg-white border border-frost-border rounded-xl focus:border-rose-600 focus:outline-hidden bn-text"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-frost-border/60">
              <Button
                variant="ghost"
                size="md"
                onClick={() => setSelectedQuarantineItem(null)}
                disabled={isDisposing}
              >
                বাতিল
              </Button>
              <Button
                variant="danger"
                size="md"
                onClick={handleExecuteDisposal}
                isLoading={isDisposing}
              >
                নিশ্চিত বিনষ্ট করুন
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
