import { useState, useEffect, useMemo, useCallback } from "react"
import type { Product, StockItem } from "../types"
import { getStock, getProducts, createProduct } from "../api/endpoints"
import BarcodeStickerModal from "../components/BarcodeStickerModal"

// BUSINESS DECISION: The Inventory overview links master product catalog definitions with
// live store stock levels. Total valuation is protected behind Owner Mode PIN.
// Low stock items trigger visual amber alert badges when total units drop below minStockAlert.

export interface InventoryProps {
  isOwner: boolean
}

interface CategoryFilter {
  id: string
  labelBn: string
  labelEn: string
  backendCategory?: string
}

const CATEGORIES: CategoryFilter[] = [
  { id: "all", labelBn: "সকল", labelEn: "All" },
  {
    id: "insecticide",
    labelBn: "কীটনাশক",
    labelEn: "Insecticide",
    backendCategory: "Insecticide",
  },
  {
    id: "fungicide",
    labelBn: "ছত্রাকনাশক",
    labelEn: "Fungicide",
    backendCategory: "Fungicide",
  },
  {
    id: "herbicide",
    labelBn: "আগাছানাশক",
    labelEn: "Herbicide",
    backendCategory: "Herbicide",
  },
  {
    id: "bio",
    labelBn: "গ্রোথ প্রমোটার",
    labelEn: "Bio-stimulant",
    backendCategory: "Bio-stimulant",
  },
  { id: "seed", labelBn: "বীজ", labelEn: "Seed", backendCategory: "Seed" },
]

export default function Inventory({ isOwner }: InventoryProps) {
  const [stocks, setStocks] = useState<StockItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Filters & Search
  const [search, setSearch] = useState<string>("")
  const [activeCategory, setActiveCategory] = useState<string>("all")
  const [onlyLowStock, setOnlyLowStock] = useState<boolean>(false)

  // Expanded lots accordion state (keyed by productId)
  const [expandedProductIds, setExpandedProductIds] = useState<Set<number>>(
    new Set(),
  )

  // Modal states
  const [stickerItem, setStickerItem] = useState<StockItem | null>(null)
  const [isStickerOpen, setIsStickerOpen] = useState<boolean>(false)
  const [showAddProduct, setShowAddProduct] = useState<boolean>(false)

  // New product form state
  const [newProdNameBn, setNewProdNameBn] = useState("")
  const [newProdNameEn, setNewProdNameEn] = useState("")
  const [newProdCode, setNewProdCode] = useState("")
  const [newProdCategory, setNewProdCategory] = useState("Insecticide")
  const [newProdBaseUnit, setNewProdBaseUnit] = useState("Bottle")
  const [newProdCartonMult, setNewProdCartonMult] = useState("20")
  const [newProdRetail, setNewProdRetail] = useState("")
  const [newProdWholesale, setNewProdWholesale] = useState("")
  const [newProdMinStock, setNewProdMinStock] = useState("5")
  const [isSavingProd, setIsSavingProd] = useState(false)

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setErrorMessage(null)
      const [stockData, productData] = await Promise.all([
        getStock(),
        getProducts(),
      ])
      setStocks(stockData)
      setProducts(productData)
    } catch (err: any) {
      setErrorMessage(
        err?.message || "স্টক ডেটা লোড করতে সমস্যা হয়েছে। পুনরায় চেষ্টা করুন।",
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

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

    // First initialize from product master catalog
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

    // Accumulate stock rows from lots
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
          retailPrice: stock.lotRetailPrice,
          wholesalePrice: stock.lotWholesalePrice,
          totalStock: 0,
          lots: [],
        }
        map.set(pId, entry)
      }
      entry.totalStock += Number(stock.quantity ?? stock.totalQuantity) || 0
      entry.lots.push(stock)
    }

    return Array.from(map.values())
  }, [products, stocks])

  // Filter products by category, search, and low stock
  const filteredProducts = useMemo(() => {
    return groupedProducts.filter((item) => {
      // Category filter
      if (activeCategory !== "all") {
        const catConfig = CATEGORIES.find((c) => c.id === activeCategory)
        if (
          catConfig?.backendCategory &&
          item.category.toLowerCase() !==
            catConfig.backendCategory.toLowerCase()
        ) {
          return false
        }
      }

      // Search query
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const matchCode = item.productCode.toLowerCase().includes(q)
        const matchEn = item.nameEn.toLowerCase().includes(q)
        const matchBn = item.nameBn.includes(search.trim())
        const matchLot = item.lots.some(
          (l) =>
            l.lotNumber.toLowerCase().includes(q) ||
            (l.barcode && l.barcode.toLowerCase().includes(q)),
        )
        if (!matchCode && !matchEn && !matchBn && !matchLot) {
          return false
        }
      }

      // Low stock only
      if (onlyLowStock) {
        if (item.totalStock > item.minStockAlert) {
          return false
        }
      }

      return true
    })
  }, [groupedProducts, activeCategory, search, onlyLowStock])

  // Summary figures
  const totalStockUnits = useMemo(
    () => groupedProducts.reduce((sum, p) => sum + p.totalStock, 0),
    [groupedProducts],
  )
  const lowStockCount = useMemo(
    () =>
      groupedProducts.filter((p) => p.totalStock <= p.minStockAlert).length,
    [groupedProducts],
  )
  const totalValuation = useMemo(() => {
    return stocks.reduce(
      (sum, s) => sum + (s.totalQuantity || 0) * (s.purchaseCost || 0),
      0,
    )
  }, [stocks])

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

  const openSticker = (item: StockItem) => {
    setStickerItem(item)
    setIsStickerOpen(true)
  }

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProdNameBn.trim() || !newProdNameEn.trim()) {
      alert("পণ্যের নাম আবশ্যক")
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
        companyName: "Syngenta",
        category: newProdCategory,
        baseUnit: newProdBaseUnit,
        cartonMultiplier: parseFloat(newProdCartonMult) || 20,
        standardRetailPrice: parseFloat(newProdRetail) || 0,
        standardWholesalePrice: parseFloat(newProdWholesale) || 0,
        minStockAlert: parseInt(newProdMinStock) || 5,
        defaultBarcode: `${code}-DEFAULT`,
      })
      setShowAddProduct(false)
      setNewProdNameBn("")
      setNewProdNameEn("")
      setNewProdCode("")
      setNewProdRetail("")
      setNewProdWholesale("")
      await loadData()
    } catch (err: any) {
      alert(err?.message || "পণ্য যোগ করতে ত্রুটি হয়েছে")
    } finally {
      setIsSavingProd(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Top Header & Overview Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-frost-dark bn-text flex items-center gap-2">
            <span>📦</span>
            <span>পণ্য ক্যাটালগ ও মাল্টি-লোকেশন স্টক (Catalog & Stock)</span>
          </h1>
          <p className="text-xs text-frost-muted mt-0.5 bn-text">
            দোকান কাউন্টার ও গুদামের রিয়েল-টাইম ব্যালেন্স, সতর্কবার্তা ও বারকোড
            লেবেল জেনারেটর
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddProduct((prev) => !prev)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-700 text-white hover:bg-emerald-800 transition-colors shadow-xs cursor-pointer bn-text"
          >
            <span>{showAddProduct ? "✕" : "➕"}</span>
            <span>{showAddProduct ? "ফর্ম বন্ধ" : "নতুন পণ্য যোগ"}</span>
          </button>
          <button
            onClick={() => loadData()}
            disabled={isLoading}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-frost-border text-frost-dark hover:bg-frost-hover cursor-pointer transition-colors shadow-xs"
            title="রিফ্রেশ করুন"
          >
            <span className={isLoading ? "animate-spin" : ""}>🔄</span>
            <span className="bn-text hidden sm:inline">রিফ্রেশ</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-frost-border rounded-xl p-4 shadow-xs">
          <p className="text-xs font-medium text-frost-muted bn-text">
            মোট নিবন্ধিত পণ্য
          </p>
          <p className="text-2xl font-black text-frost-dark tabular-nums mt-1">
            {products.length}{" "}
            <span className="text-xs font-normal text-frost-muted">টি</span>
          </p>
        </div>

        <div className="bg-white border border-frost-border rounded-xl p-4 shadow-xs">
          <p className="text-xs font-medium text-frost-muted bn-text">
            মোট উপলব্ধ স্টক (সকল স্থান)
          </p>
          <p className="text-2xl font-black text-emerald-700 tabular-nums mt-1">
            {totalStockUnits.toLocaleString("en-IN")}{" "}
            <span className="text-xs font-normal text-frost-muted">ইউনিট</span>
          </p>
        </div>

        <div
          onClick={() => setOnlyLowStock((prev) => !prev)}
          className={`border rounded-xl p-4 shadow-xs cursor-pointer transition-all ${
            lowStockCount > 0
              ? "bg-amber-50/70 border-amber-300 hover:bg-amber-100/70"
              : "bg-white border-frost-border"
          }`}
          title="ক্লিক করলে শুধুমাত্র কম স্টক পণ্য ফিল্টার হবে"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-frost-muted bn-text">
              কম স্টক সতর্কতা
            </p>
            {onlyLowStock && (
              <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-bold bn-text">
                ফিল্টার সক্রিয়
              </span>
            )}
          </div>
          <p
            className={`text-2xl font-black tabular-nums mt-1 ${
              lowStockCount > 0 ? "text-amber-700" : "text-frost-dark"
            }`}
          >
            {lowStockCount}{" "}
            <span className="text-xs font-normal text-frost-muted">
              আইটেম ↓
            </span>
          </p>
        </div>

        <div className="bg-white border border-frost-border rounded-xl p-4 shadow-xs">
          <p className="text-xs font-medium text-frost-muted bn-text">
            মোট স্টক ক্রয়মূল্য (Valuation)
          </p>
          <p className="text-2xl font-black text-frost-dark tabular-nums mt-1">
            {isOwner ? (
              `৳${totalValuation.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
            ) : (
              <span className="text-sm font-bold text-frost-muted">
                🔒 মালিকের পিন দরকার
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Inline New Product Form Collapsible */}
      {showAddProduct && (
        <form
          onSubmit={handleCreateProduct}
          className="bg-white border-2 border-emerald-500/40 rounded-2xl p-5 shadow-md space-y-4 animate-in fade-in"
        >
          <div className="flex items-center justify-between border-b border-frost-border pb-3">
            <h3 className="font-bold text-frost-dark bn-text text-base flex items-center gap-2">
              <span>🌾</span>
              <span>নতুন সিনজেনটা পণ্য মাস্টার ক্যাটালগে যুক্ত করুন</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowAddProduct(false)}
              className="text-frost-muted hover:text-frost-dark text-sm p-1"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-frost-dark bn-text mb-1">
                পণ্যের নাম (বাংলা) *
              </label>
              <input
                type="text"
                required
                value={newProdNameBn}
                onChange={(e) => setNewProdNameBn(e.target.value)}
                placeholder="যেমন: স্কোর ২৫০ ইসি"
                className="field text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-frost-dark bn-text mb-1">
                Product Name (English) *
              </label>
              <input
                type="text"
                required
                value={newProdNameEn}
                onChange={(e) => setNewProdNameEn(e.target.value)}
                placeholder="e.g. Score 250 EC"
                className="field text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-frost-dark bn-text mb-1">
                প্রোডাক্ট কোড (Product Code)
              </label>
              <input
                type="text"
                value={newProdCode}
                onChange={(e) => setNewProdCode(e.target.value)}
                placeholder="যেমন: SYN-SCO-250"
                className="field text-sm uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-semibold text-frost-dark bn-text mb-1">
                ক্যাটাগরি
              </label>
              <select
                value={newProdCategory}
                onChange={(e) => setNewProdCategory(e.target.value)}
                className="field text-sm"
              >
                <option value="Insecticide">কীটনাশক (Insecticide)</option>
                <option value="Fungicide">ছত্রাকনাশক (Fungicide)</option>
                <option value="Herbicide">আগাছানাশক (Herbicide)</option>
                <option value="Bio-stimulant">
                  গ্রোথ প্রমোটার (Bio-stimulant)
                </option>
                <option value="Seed">বীজ (Seed)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-frost-dark bn-text mb-1">
                বেস ইউনিট
              </label>
              <select
                value={newProdBaseUnit}
                onChange={(e) => setNewProdBaseUnit(e.target.value)}
                className="field text-sm"
              >
                <option value="Bottle">বোতল (Bottle)</option>
                <option value="Packet">প্যাকেট (Packet)</option>
                <option value="Kg">কেজি (Kg)</option>
                <option value="Liter">লিটার (Liter)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-frost-dark bn-text mb-1">
                ১ কার্টনে ইউনিট সংখ্যা
              </label>
              <input
                type="number"
                min="1"
                value={newProdCartonMult}
                onChange={(e) => setNewProdCartonMult(e.target.value)}
                className="field text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-frost-dark bn-text mb-1">
                খুচরা রেট (৳)
              </label>
              <input
                type="number"
                min="0"
                value={newProdRetail}
                onChange={(e) => setNewProdRetail(e.target.value)}
                placeholder="০"
                className="field text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-frost-dark bn-text mb-1">
                পাইকারি রেট (৳)
              </label>
              <input
                type="number"
                min="0"
                value={newProdWholesale}
                onChange={(e) => setNewProdWholesale(e.target.value)}
                placeholder="০"
                className="field text-sm tabular-nums"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddProduct(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-frost-muted hover:bg-frost-hover bn-text"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={isSavingProd}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50 bn-text shadow-xs"
            >
              {isSavingProd ? "সংরক্ষণ হচ্ছে..." : "পণ্য সংরক্ষণ করুন"}
            </button>
          </div>
        </form>
      )}

      {/* Search Bar & Category Filter Chips */}
      <div className="bg-white border border-frost-border rounded-xl p-3 space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-2.5 text-frost-muted text-base">
              🔍
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="পণ্যের বাংলা/ইংরেজি নাম, কোড বা লট নম্বর দিয়ে খুঁজুন..."
              className="w-full bg-frost-surface border border-frost-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-frost-dark placeholder-frost-muted focus:bg-white focus:border-emerald-600 focus:outline-hidden transition-all bn-text"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-2.5 text-frost-muted hover:text-frost-dark text-xs p-0.5"
              >
                ✕
              </button>
            )}
          </div>

          <span className="text-xs text-frost-muted whitespace-nowrap self-center font-semibold bn-text">
            {filteredProducts.length}টি পণ্য প্রদর্শিত
          </span>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer bn-text ${
                  isActive
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "bg-frost-surface text-frost-muted hover:bg-frost-hover hover:text-frost-dark"
                }`}
              >
                <span>{cat.labelBn}</span>
                <span
                  className={`text-[10px] ml-1 font-normal ${
                    isActive ? "text-emerald-100" : "text-frost-muted/70"
                  }`}
                >
                  ({cat.labelEn})
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold bn-text flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => loadData()}
            className="underline font-bold hover:text-red-900"
          >
            পুনরায় চেষ্টা করুন
          </button>
        </div>
      )}

      {/* Product Catalog & Stock Table */}
      <div className="bg-white border border-frost-border rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-frost-surface border-b border-frost-border text-frost-muted">
                <th className="px-4 py-3 font-bold bn-text">
                  পণ্য (Code &amp; Name)
                </th>
                <th className="px-3 py-3 font-bold bn-text hidden md:table-cell">
                  ক্যাটাগরি
                </th>
                <th className="px-3 py-3 font-bold bn-text hidden lg:table-cell text-center">
                  কার্টন সাইজ
                </th>
                <th className="px-3 py-3 font-bold bn-text text-right hidden sm:table-cell">
                  স্ট্যান্ডার্ড রেট
                </th>
                <th className="px-3 py-3 font-bold bn-text text-right">
                  মজুদ স্টক
                </th>
                <th className="px-4 py-3 font-bold bn-text text-center">
                  অ্যাকশন
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-frost-border/50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-frost-muted">
                    <span className="text-xl animate-spin inline-block">⏳</span>
                    <p className="mt-2 text-xs bn-text">
                      স্টক তথ্য লোড হচ্ছে...
                    </p>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-frost-muted">
                    <span className="text-3xl">🔍</span>
                    <p className="mt-2 text-sm font-semibold bn-text">
                      কোনো পণ্য খুঁজে পাওয়া যায়নি
                    </p>
                    <p className="text-xs text-frost-muted/70 mt-0.5">
                      সার্চ কিওয়ার্ড বা ফিল্টার পরিবর্তন করে দেখুন
                    </p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isLow = p.totalStock <= p.minStockAlert
                  const isExpanded = expandedProductIds.has(p.productId)
                  const primaryLot = p.lots[0] || null

                  return (
                    <tr
                      key={p.productId}
                      className={`group transition-colors ${
                        isLow
                          ? "bg-amber-50/40 hover:bg-amber-50"
                          : "hover:bg-frost-surface/50"
                      }`}
                    >
                      {/* Product Name & Code */}
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-start gap-2">
                          <button
                            onClick={() => toggleExpand(p.productId)}
                            className="mt-0.5 text-xs text-frost-muted hover:text-emerald-700 cursor-pointer p-0.5"
                            title={isExpanded ? "লট সংক্ষেপ করুন" : "লট বিস্তার করুন"}
                          >
                            {isExpanded ? "▼" : "▶"}
                          </button>
                          <div>
                            <div className="font-bold text-sm text-frost-dark bn-text leading-tight">
                              {p.nameBn}
                            </div>
                            <div className="text-[11px] text-frost-muted leading-tight mt-0.5">
                              {p.nameEn}
                            </div>
                            <span className="inline-block mt-1 px-1.5 py-0.2 rounded bg-frost-surface border border-frost-border font-mono text-[10px] text-frost-muted">
                              {p.productCode}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-3 py-3 align-top hidden md:table-cell">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-frost-surface text-frost-dark border border-frost-border bn-text">
                          {p.category}
                        </span>
                      </td>

                      {/* Carton Multiplier */}
                      <td className="px-3 py-3 align-top hidden lg:table-cell text-center">
                        <span className="text-xs font-semibold tabular-nums text-frost-dark">
                          ১ × {p.cartonMultiplier}{" "}
                          <span className="text-frost-muted text-[10px]">
                            {p.baseUnit}
                          </span>
                        </span>
                      </td>

                      {/* Rates */}
                      <td className="px-3 py-3 align-top text-right hidden sm:table-cell">
                        <div className="font-bold text-frost-dark tabular-nums">
                          ৳{p.retailPrice}
                        </div>
                        <div className="text-[10px] text-frost-muted tabular-nums">
                          পাইকারি: ৳{p.wholesalePrice}
                        </div>
                      </td>



                      {/* Total Stock & Low Alert */}
                      <td className="px-3 py-3 align-top text-right">
                        <div className="font-black tabular-nums text-sm text-frost-dark">
                          {p.totalStock} {p.baseUnit}
                        </div>
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded mt-0.5 bn-text">
                            ⚠️ কম স্টক (সতর্কতা: {p.minStockAlert})
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-700 font-semibold bn-text">
                            পর্যাপ্ত
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 align-top text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => toggleExpand(p.productId)}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-frost-surface hover:bg-frost-hover text-frost-dark border border-frost-border transition-colors cursor-pointer bn-text"
                            title="লট তালিকা দেখুন"
                          >
                            <span>📋</span>
                            <span className="ml-1">
                              লট তালিকা ({p.lots.length})
                            </span>
                          </button>

                          {primaryLot && (
                            <button
                              onClick={() => openSticker(primaryLot)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-colors cursor-pointer bn-text"
                              title="বারকোড স্টিকার প্রিন্ট করুন"
                            >
                              <span>🏷️</span>
                              <span className="ml-1">বারকোড স্টিকার</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expanded Lot Drawers below table for products that were expanded */}
      {Array.from(expandedProductIds).map((pId) => {
        const p = groupedProducts.find((item) => item.productId === pId)
        if (!p || p.lots.length === 0) return null

        return (
          <div
            key={pId}
            className="bg-emerald-50/50 border-2 border-emerald-300 rounded-xl p-4 shadow-sm space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">📋</span>
                <h4 className="font-bold text-sm text-emerald-950 bn-text">
                  {p.nameBn} ({p.nameEn}) — লট বিস্তারিত তালিকা (Batches)
                </h4>
              </div>
              <button
                onClick={() => toggleExpand(pId)}
                className="text-xs text-frost-muted hover:text-frost-dark px-2 py-1"
              >
                ✕ বন্ধ করুন
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left bg-white rounded-lg border border-frost-border overflow-hidden">
                <thead>
                  <tr className="bg-frost-surface border-b border-frost-border text-frost-muted">
                    <th className="px-3 py-2 font-bold bn-text">লট নম্বর</th>
                    <th className="px-3 py-2 font-bold bn-text">মেয়াদ (Expiry)</th>
                    <th className="px-3 py-2 font-bold bn-text text-right">
                      মজুদ স্টক
                    </th>
                    <th className="px-3 py-2 font-bold bn-text text-right">
                      খুচরা মূল্য
                    </th>
                    {isOwner && (
                      <th className="px-3 py-2 font-bold bn-text text-right text-emerald-800">
                        কেনা দাম
                      </th>
                    )}
                    <th className="px-3 py-2 font-bold bn-text text-center">
                      বারকোড
                    </th>
                    <th className="px-3 py-2 font-bold bn-text text-center">
                      অ্যাকশন
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-frost-border/50">
                  {p.lots.map((lot) => (
                    <tr key={lot.lotId} className="hover:bg-frost-surface/40">
                      <td className="px-3 py-2 font-mono font-bold text-frost-dark">
                        {lot.lotNumber}
                      </td>
                      <td className="px-3 py-2 font-mono text-frost-dark">
                        {lot.expiryDate}
                      </td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">
                        {lot.quantity} {lot.baseUnit}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        ৳{lot.lotRetailPrice}
                      </td>
                      {isOwner && (
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-emerald-700">
                          ৳{lot.purchaseCost}
                        </td>
                      )}
                      <td className="px-3 py-2 text-center font-mono text-[11px] text-frost-muted">
                        {lot.barcode || lot.lotBarcode}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openSticker(lot)}
                            className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 cursor-pointer bn-text"
                            title="স্টিকার প্রিন্ট"
                          >
                            🏷️ স্টিকার
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {/* Barcode Sticker Modal */}
      <BarcodeStickerModal
        item={stickerItem}
        isOpen={isStickerOpen}
        onClose={() => {
          setIsStickerOpen(false)
          setStickerItem(null)
        }}
      />
    </div>
  )
}
