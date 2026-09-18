import { useState, useEffect, useMemo } from "react"
import {
  Percent,
  Sliders,
  Check,
  RotateCcw,
  Sparkles,
  ShoppingBag,
  TrendingUp,
  Package,
} from "lucide-react"
import {
  getWholesaleSettings,
  saveWholesaleSettings,
  calcWholesalePrice,
  DEFAULT_WHOLESALE_SETTINGS,
  type WholesaleSettings,
} from "../utils/wholesaleSettings"
import { getStock, getProducts } from "../api/endpoints"
import type { Product, StockItem } from "../types"
import { formatTk, roundAccounting } from "../utils/currency"
import { useToast } from "../context/ToastContext"
import { useAuth } from "../context/AuthContext"
import Button from "../components/ui/Button"
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

export interface WholesaleSettingsProps {
  isOwner?: boolean
}

export default function WholesaleSettingsPage({ isOwner: propIsOwner }: WholesaleSettingsProps) {
  const { isOwner: authIsOwner, openPinModal } = useAuth()
  const { showSuccess, showError, showWarning } = useToast()
  const isOwner = propIsOwner !== undefined ? propIsOwner : authIsOwner

  const [settings, setSettings] = useState<WholesaleSettings>(getWholesaleSettings)
  const [ratioInput, setRatioInput] = useState<string>(() =>
    String(getWholesaleSettings().discountPercentage),
  )
  const [simulatedRetail, setSimulatedRetail] = useState<string>("100")
  const [isSaving, setIsSaving] = useState(false)

  // Remote products & stock data for real-world margin impact preview
  const [products, setProducts] = useState<Product[]>([])
  const [stocks, setStocks] = useState<StockItem[]>([])
  const [isLoadingData, setIsLoadingData] = useState(false)

  useEffect(() => {
    const handleSettingsUpdated = (e: Event) => {
      const custom = e as CustomEvent<WholesaleSettings>
      if (custom.detail) {
        setSettings(custom.detail)
        setRatioInput(String(custom.detail.discountPercentage))
      }
    }
    window.addEventListener("wholesale-settings-updated", handleSettingsUpdated)
    return () => window.removeEventListener("wholesale-settings-updated", handleSettingsUpdated)
  }, [])

  useEffect(() => {
    let mounted = true
    setIsLoadingData(true)
    Promise.all([getProducts().catch(() => []), getStock().catch(() => [])])
      .then(([prods, stks]) => {
        if (mounted) {
          setProducts(prods)
          setStocks(stks)
        }
      })
      .finally(() => {
        if (mounted) setIsLoadingData(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const currentRatio = useMemo(() => {
    const parsed = parseFloat(ratioInput)
    return isNaN(parsed) || parsed < 0 ? 0 : Math.min(100, parsed)
  }, [ratioInput])

  const handleQuickSelect = (pct: number) => {
    setRatioInput(String(pct))
  }

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const ratio = parseFloat(ratioInput)
    if (isNaN(ratio) || ratio < 0 || ratio > 100) {
      showWarning("Please enter a valid wholesale ratio between 0% and 100%!")
      return
    }

    try {
      setIsSaving(true)
      const updated = saveWholesaleSettings({
        discountPercentage: roundAccounting(ratio),
        enabled: true,
      })
      setSettings(updated)
      showSuccess(`Wholesale preset ratio successfully saved at ${updated.discountPercentage}%!`)
    } catch (err) {
      showError(err, "Failed to save wholesale settings")
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetToDefault = () => {
    setRatioInput(String(DEFAULT_WHOLESALE_SETTINGS.discountPercentage))
    const updated = saveWholesaleSettings({
      discountPercentage: DEFAULT_WHOLESALE_SETTINGS.discountPercentage,
      enabled: true,
    })
    setSettings(updated)
    showSuccess("Reset wholesale preset ratio to default (5%)!")
  }

  // Live simulation math
  const testRetail = parseFloat(simulatedRetail) || 100
  const simulatedWholesale = calcWholesalePrice(testRetail, {
    discountPercentage: currentRatio,
    enabled: true,
  })
  const simulatedDiscount = roundAccounting(testRetail - simulatedWholesale)

  // Real inventory items preview
  const previewItems = useMemo(() => {
    return products.slice(0, 10).map((prod) => {
      const retail = prod.standardRetailPrice || 0
      const buying =
        prod.buyingPrice ??
        (prod.standardWholesalePrice ? Math.round(prod.standardWholesalePrice * 0.88) : 0)
      const wsPrice = calcWholesalePrice(retail, {
        discountPercentage: currentRatio,
        enabled: true,
      })
      const netProfit = buying > 0 ? roundAccounting(wsPrice - buying) : null
      const profitMarginPct =
        buying > 0 && wsPrice > 0 ? Math.round((netProfit! / wsPrice) * 100) : null

      return {
        id: prod.id,
        nameEn: prod.nameEn,
        nameBn: prod.nameBn,
        productCode: prod.productCode,
        category: prod.category,
        baseUnit: prod.baseUnit,
        retailPrice: retail,
        buyingPrice: buying,
        wholesalePrice: wsPrice,
        netProfit,
        profitMarginPct,
      }
    })
  }, [products, currentRatio])

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-purple-950 via-purple-900 to-indigo-900 text-white rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-3 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-xs shrink-0">
            <Percent className="w-7 h-7 text-purple-200" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-bold text-xl leading-tight">Wholesale Settings</h1>
              <span className="bg-purple-800/80 text-purple-200 text-xs px-2.5 py-0.5 rounded-full border border-purple-400/30 font-medium">
                Main Menu Configuration
              </span>
            </div>
            <p className="text-xs text-purple-200 mt-1 max-w-2xl leading-relaxed">
              Preset the wholesale price ratio from retail price. When generating an order at the POS counter, clicking the <strong>Wholesale</strong> button automatically fetches this pre-configured setting and calculates wholesale prices in real-time.
            </p>
          </div>
        </div>

        <div className="bg-white/10 border border-white/20 backdrop-blur-xs rounded-xl p-3.5 text-right shrink-0 min-w-[160px]">
          <span className="text-[11px] text-purple-200 font-medium block">
            Current Wholesale Ratio
          </span>
          <span className="text-3xl font-black font-mono text-white tabular-nums">
            {settings.discountPercentage}%
          </span>
          <span className="text-[10px] text-purple-300 block mt-0.5 font-medium">
            Deducted from Retail Price
          </span>
        </div>
      </div>

      {/* Main Ratio Controller & Interactive Simulator Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left 7 Cols: Ratio Configuration Card */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-purple-700" />
              <h2 className="font-bold text-base text-slate-900">
                Preset Wholesale Price Ratio
              </h2>
            </div>
            <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200 font-mono">
              Formula: Retail × (1 - {currentRatio}%)
            </span>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-900">
                  Wholesale Discount Ratio (%):
                </label>
                <span className="text-xs text-slate-500 font-medium">
                  Configured: <strong className="text-purple-800 font-mono">{currentRatio}%</strong>
                </span>
              </div>

              {/* Number Input & Percentage */}
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={ratioInput}
                  onChange={(e) => setRatioInput(e.target.value)}
                  placeholder="5"
                  required
                  className="w-full bg-white border-2 border-purple-200 focus:border-purple-600 rounded-xl px-4 py-3 text-lg font-black font-mono text-slate-900 focus:outline-hidden tabular-nums transition-all"
                />
                <span className="absolute right-4 top-3.5 text-base font-bold text-purple-800">
                  %
                </span>
              </div>

              {/* Range Slider for fast, intuitive adjustment */}
              <div className="pt-3 px-1">
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="0.5"
                  value={currentRatio}
                  onChange={(e) => setRatioInput(e.target.value)}
                  className="w-full accent-purple-700 cursor-pointer h-2 bg-slate-200 rounded-lg appearance-none"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                  <span>0% (Retail)</span>
                  <span>5% (Default)</span>
                  <span>10%</span>
                  <span>15%</span>
                  <span>20%</span>
                  <span>30%</span>
                </div>
              </div>
            </div>

            {/* Quick Preset Buttons */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Quick Preset Options:
              </label>
              <div className="flex flex-wrap gap-2">
                {[3, 5, 7, 8, 10, 12, 15, 20].map((pct) => {
                  const isSelected = currentRatio === pct
                  return (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handleQuickSelect(pct)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                        isSelected
                          ? "bg-purple-700 text-white shadow-sm ring-2 ring-purple-500/20"
                          : "bg-slate-50 text-slate-700 border border-slate-200 hover:bg-purple-50 hover:text-purple-900"
                      }`}
                    >
                      {pct}% {pct === 5 ? "(Default)" : ""}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* How POS Counter Works Explanation Box */}
            <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl space-y-1.5 text-xs text-purple-950">
              <div className="font-bold flex items-center gap-1.5 text-purple-900">
                <Sparkles className="w-4 h-4 text-purple-700" />
                <span>How this controls orders at the POS Counter:</span>
              </div>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-purple-900/90 leading-relaxed">
                <li>
                  When counter clerks generate an order, they click the <strong>Wholesale</strong> button at checkout.
                </li>
                <li>
                  The POS counter immediately fetches this preset ratio ({currentRatio}%) and applies it to every item in the cart.
                </li>
                <li>
                  Suppose retail price of a product is ৳100. The order automatically sells at <strong>৳{calcWholesalePrice(100, { discountPercentage: currentRatio, enabled: true })}</strong>.
                </li>
                <li>
                  No static wholesale prices need to be typed or maintained in stock lots.
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-between border-t border-slate-200/60">
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={handleResetToDefault}
                leftIcon={<RotateCcw className="w-4 h-4" />}
                className="text-slate-600 hover:text-slate-900"
              >
                Reset to Default (5%)
              </Button>

              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isSaving}
                leftIcon={<Check className="w-4 h-4" />}
                className="bg-purple-700 hover:bg-purple-800 text-white px-5"
              >
                Save Wholesale Ratio
              </Button>
            </div>
          </form>
        </div>

        {/* Right 5 Cols: Live Price Calculator & Simulator */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-700" />
                <h3 className="font-bold text-base text-slate-900">
                  Wholesale Price Calculator
                </h3>
              </div>
              <span className="text-[11px] text-slate-500">Live Simulator</span>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  Sample Product Retail Price (৳):
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm font-bold text-slate-400">৳</span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={simulatedRetail}
                    onChange={(e) => setSimulatedRetail(e.target.value)}
                    placeholder="100.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2.5 text-base font-bold font-mono text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Simulation Result Display */}
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50/50 border-2 border-purple-300 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-purple-950">
                    Retail Price:
                  </span>
                  <span className="text-sm font-mono font-bold text-slate-900">
                    {formatTk(testRetail)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-purple-950 flex items-center gap-1">
                    <span>Wholesale Discount ({currentRatio}%):</span>
                  </span>
                  <span className="text-sm font-mono font-bold text-red-600">
                    -{formatTk(simulatedDiscount)}
                  </span>
                </div>

                <div className="pt-2 border-t border-purple-200/80 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-purple-950 block">
                      Calculated Wholesale Price:
                    </span>
                    <span className="text-[10px] text-purple-700">
                      Applied at POS counter
                    </span>
                  </div>
                  <span className="text-2xl font-black font-mono text-purple-900 tabular-nums">
                    {formatTk(simulatedWholesale)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Mockup Banner */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1 text-slate-600">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5 text-emerald-700" />
              <span>POS Order Integration:</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              When toggling from <strong>Retail</strong> to <strong>Wholesale</strong> on the counter, prices update automatically based on this ratio setting without any manual calculations.
            </p>
          </div>
        </div>
      </div>

      {/* Real Inventory Products Impact Analysis Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-slate-700" />
              <span>Catalog Wholesale Margin Analysis</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live profit margins for registered products under the active {currentRatio}% wholesale ratio
            </p>
          </div>

          <span className="text-xs font-semibold text-slate-500 font-mono">
            {products.length} Products Registered
          </span>
        </div>

        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Product &amp; Code</TableHeaderCell>
              <TableHeaderCell>Category</TableHeaderCell>
              <TableHeaderCell>Packaging Unit</TableHeaderCell>
              <TableHeaderCell align="right">Retail Price</TableHeaderCell>
              <TableHeaderCell align="right">Buying Price</TableHeaderCell>
              <TableHeaderCell align="right">Wholesale Price (-{currentRatio}%)</TableHeaderCell>
              <TableHeaderCell align="right">Dealer Margin (৳)</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoadingData ? (
              <TableLoadingState colSpan={7} text="Loading catalog products..." />
            ) : previewItems.length === 0 ? (
              <TableEmptyState
                colSpan={7}
                icon={<Package className="w-8 h-8" />}
                message="No products in catalog"
                submessage="Add products in Dokan Stock Management"
              />
            ) : (
              previewItems.map((item) => (
                <TableRow key={item.id}>
                  {/* Product Info */}
                  <TableCell>
                    <div>
                      <div className="font-bold text-slate-900 text-sm">
                        {item.nameEn}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                        <span>{item.nameBn}</span>
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

                  {/* Unit */}
                  <TableCell>
                    <span className="text-xs font-semibold text-slate-900 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                      {item.baseUnit}
                    </span>
                  </TableCell>

                  {/* Retail Price */}
                  <TableCell align="right" isMonospace className="font-bold text-slate-900">
                    {formatTk(item.retailPrice)}
                  </TableCell>

                  {/* Buying Price (Owner Mode / Masked in Cashier Mode) */}
                  <TableCell align="right" isMonospace>
                    {isOwner ? (
                      <span className="text-amber-800 font-bold">
                        {item.buyingPrice > 0 ? formatTk(item.buyingPrice) : "—"}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={openPinModal}
                        className="text-slate-400 hover:text-slate-600 cursor-pointer text-xs font-mono inline-flex items-center gap-1"
                        title="Owner PIN required to view buying price"
                      >
                        <span>••••</span>
                        <span className="text-[10px]">🔒</span>
                      </button>
                    )}
                  </TableCell>

                  {/* Calculated Wholesale Price */}
                  <TableCell align="right" isMonospace className="font-black text-purple-800">
                    {formatTk(item.wholesalePrice)}
                  </TableCell>

                  {/* Dealer Margin */}
                  <TableCell align="right" isMonospace>
                    {isOwner ? (
                      item.netProfit !== null ? (
                        <div className="inline-flex flex-col items-end">
                          <span
                            className={`font-bold ${
                              item.netProfit >= 0 ? "text-emerald-800" : "text-red-600"
                            }`}
                          >
                            {formatTk(item.netProfit)}
                          </span>
                          {item.profitMarginPct !== null && (
                            <span className="text-[10px] text-slate-500">
                              ({item.profitMarginPct}% margin)
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )
                    ) : (
                      <span className="text-slate-400 font-mono text-xs">•••• 🔒</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
