import { useState, useRef } from "react"
import Navbar from "./components/Navbar"
import PosCounter from "./pages/PosCounter"
import type { NavigationTab } from "./types"

// ─── Types ────────────────────────────────────────────────────────
type Product = {
  id: string
  name: string
  nameBn: string
  category: string
  purchasePrice: number
  retailPrice: number
  wholesalePrice: number
  stock: number
  barcode: string
}

type CartItem = { product: Product qty: number }
type SaleMode = "retail" | "wholesale"

type Customer = {
  id: string
  name: string
  nameBn: string
  phone: string
  village: string
  due: number
}

// ─── Sample Data ──────────────────────────────────────────────────
const INITIAL_PRODUCTS: Product[] = [
  {
    id: "P001",
    name: "Miniket Rice",
    nameBn: "মিনিকেট চাল",
    category: "চাল",
    purchasePrice: 52,
    retailPrice: 58,
    wholesalePrice: 55,
    stock: 150,
    barcode: "8901234560001",
  },
  {
    id: "P002",
    name: "Wheat Flour (Atta)",
    nameBn: "গমের আটা",
    category: "আটা",
    purchasePrice: 38,
    retailPrice: 45,
    wholesalePrice: 42,
    stock: 80,
    barcode: "8901234560002",
  },
  {
    id: "P003",
    name: "Soybean Oil 1L",
    nameBn: "সয়াবিন তেল ১লি",
    category: "তেল",
    purchasePrice: 135,
    retailPrice: 148,
    wholesalePrice: 142,
    stock: 4,
    barcode: "8901234560003",
  },
  {
    id: "P004",
    name: "Sugar 1kg",
    nameBn: "চিনি ১কেজি",
    category: "চিনি",
    purchasePrice: 115,
    retailPrice: 125,
    wholesalePrice: 120,
    stock: 60,
    barcode: "8901234560004",
  },
  {
    id: "P005",
    name: "Salt 1kg",
    nameBn: "লবণ ১কেজি",
    category: "লবণ",
    purchasePrice: 18,
    retailPrice: 22,
    wholesalePrice: 20,
    stock: 3,
    barcode: "8901234560005",
  },
  {
    id: "P006",
    name: "Masoor Dal 1kg",
    nameBn: "মসুর ডাল ১কেজি",
    category: "ডাল",
    purchasePrice: 95,
    retailPrice: 108,
    wholesalePrice: 102,
    stock: 45,
    barcode: "8901234560006",
  },
  {
    id: "P007",
    name: "Onion 1kg",
    nameBn: "পেঁয়াজ ১কেজি",
    category: "সবজি",
    purchasePrice: 42,
    retailPrice: 50,
    wholesalePrice: 47,
    stock: 20,
    barcode: "8901234560007",
  },
  {
    id: "P008",
    name: "Garlic 500g",
    nameBn: "রসুন ৫০০গ্রাম",
    category: "মশলা",
    purchasePrice: 65,
    retailPrice: 75,
    wholesalePrice: 70,
    stock: 2,
    barcode: "8901234560008",
  },
  {
    id: "P009",
    name: "Ginger 500g",
    nameBn: "আদা ৫০০গ্রাম",
    category: "মশলা",
    purchasePrice: 55,
    retailPrice: 65,
    wholesalePrice: 60,
    stock: 12,
    barcode: "8901234560009",
  },
  {
    id: "P010",
    name: "Turmeric Powder 200g",
    nameBn: "হলুদ গুঁড়া ২০০গ্রাম",
    category: "মশলা",
    purchasePrice: 30,
    retailPrice: 38,
    wholesalePrice: 35,
    stock: 5,
    barcode: "8901234560010",
  },
]

const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: "C001",
    name: "Rahim Uddin",
    nameBn: "রহিম উদ্দিন",
    phone: "০১৭১১-২৩৪৫৬৭",
    village: "উত্তর পাড়া",
    due: 1250,
  },
  {
    id: "C002",
    name: "Karim Ali",
    nameBn: "করিম আলী",
    phone: "০১৮১২-৩৪৫৬৭৮",
    village: "দক্ষিণ গ্রাম",
    due: 800,
  },
  {
    id: "C003",
    name: "Fatema Begum",
    nameBn: "ফাতেমা বেগম",
    phone: "০১৯১২-৪৫৬৭৮৯",
    village: "পূর্ব মহল্লা",
    due: 0,
  },
  {
    id: "C004",
    name: "Jalal Hossain",
    nameBn: "জালাল হোসেন",
    phone: "০১৬১১-৫৬৭৮৯০",
    village: "পশ্চিম পাড়া",
    due: 3400,
  },
  {
    id: "C005",
    name: "Rokeya Khatun",
    nameBn: "রোকেয়া খাতুন",
    phone: "০১৫১১-৬৭৮৯০১",
    village: "নতুন বাজার",
    due: 650,
  },
  {
    id: "C006",
    name: "Sirajul Islam",
    nameBn: "সিরাজুল ইসলাম",
    phone: "০১৩১১-৭৮৯০১২",
    village: "পূর্ব পাড়া",
    due: 0,
  },
]

// ─── Helpers ──────────────────────────────────────────────────────
const tk = (n: number) => `৳${n.toLocaleString("en-IN")}`

function BarcodeViz({ code }: { code: string }) {
  const bars = code
    .replace(/\D/g, "")
    .padEnd(13, "0")
    .slice(0, 13)
    .split("")
    .map(Number)
  return (
    <div className="flex items-end justify-center h-10 gap-[1.5px]">
      {bars.map((d, i) => (
        <div
          key={i}
          style={{
            width: d % 3 === 0 ? 2 : 3,
            height: 28 + (d % 4) * 2,
            background: "#172537",
          }}
        />
      ))}
    </div>
  )
}

// ─── Sales Counter ─────────────────────────────────────────────────
type SaleRecord = {
  items: CartItem[]
  total: number
  cash: number
  change: number
  mode: SaleMode
  date: Date
}

function SalesCounter({
  products,
  setProducts,
  isOwner = false,
}: {
  products: Product[]
  setProducts: (fn: (p: Product[]) => Product[]) => void
  isOwner?: boolean
}) {
  const [mode, setMode] = useState<SaleMode>("retail")
  const [search, setSearch] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [cashReceived, setCashReceived] = useState("")
  const [completed, setCompleted] = useState<SaleRecord | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const getPrice = (p: Product) =>
    mode === "retail" ? p.retailPrice : p.wholesalePrice

  const searchResults =
    search.trim().length > 0
      ? products
          .filter(
            (p) =>
              p.nameBn.includes(search) ||
              p.name.toLowerCase().includes(search.toLowerCase()) ||
              p.barcode.includes(search),
          )
          .slice(0, 7)
      : []

  const addToCart = (p: Product) => {
    setCart((prev) => {
      const ex = prev.find((i) => i.product.id === p.id)
      if (ex)
        return prev.map((i) =>
          i.product.id === p.id ? { ...i, qty: i.qty + 1 } : i,
        )
      return [...prev, { product: p, qty: 1 }]
    })
    setSearch("")
    searchRef.current?.focus()
  }

  const adjustQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev.flatMap((i) => {
        if (i.product.id !== id) return [i]
        const nq = i.qty + delta
        return nq <= 0 ? [] : [{ ...i, qty: nq }]
      }),
    )
  }

  const removeFromCart = (id: string) =>
    setCart((prev) => prev.filter((i) => i.product.id !== id))

  const total = cart.reduce((s, i) => s + getPrice(i.product) * i.qty, 0)
  const cashNum = parseFloat(cashReceived) || 0
  const change = cashNum - total
  const insufficient = cashReceived !== "" && cashNum < total && cashNum > 0
  const canComplete = cart.length > 0 && cashNum >= total && cashReceived !== ""

  const quickAmounts =
    total > 0
      ? [
          ...new Set([
            total,
            Math.ceil(total / 50) * 50,
            Math.ceil(total / 100) * 100,
            Math.ceil(total / 500) * 500,
          ]),
        ].slice(0, 4)
      : []

  const completeSale = () => {
    if (!canComplete) return
    setProducts((prev) =>
      prev.map((p) => {
        const item = cart.find((i) => i.product.id === p.id)
        return item ? { ...p, stock: p.stock - item.qty } : p
      }),
    )
    setCompleted({
      items: [...cart],
      total,
      cash: cashNum,
      change,
      mode,
      date: new Date(),
    })
    setCart([])
    setCashReceived("")
  }

  const newSale = () => setCompleted(null)

  if (completed) {
    return (
      <div className="max-w-sm mx-auto">
        <div
          className="print-area bg-white border border-frost-border rounded-xl p-6"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <div className="text-center border-b border-dashed border-frost-border pb-4 mb-4">
            <p className="font-bold text-frost-dark text-base bn-text">
              মেসার্স আল-আমিন স্টোর
            </p>
            <p className="text-xs text-frost-muted bn-text">
              উত্তর বাজার, নরসিংদী · ০১৭১১-১২৩৪৫৬
            </p>
            <p className="text-xs text-frost-muted mt-1">
              {completed.date.toLocaleDateString("bn-BD")} ·{" "}
              {completed.date.toLocaleTimeString("bn-BD")}
            </p>
            <span className="inline-block mt-1 text-xs bg-frost-surface border border-frost-border rounded px-2 py-0.5 text-frost-muted bn-text">
              {completed.mode === "wholesale" ? "পাইকারি" : "খুচরা"} বিক্রয়
            </span>
          </div>
          <table className="w-full text-xs mb-4">
            <thead>
              <tr className="text-frost-muted border-b border-frost-border">
                <th className="text-left pb-1.5 font-medium bn-text">পণ্য</th>
                <th className="text-center pb-1.5 font-medium">×</th>
                <th className="text-right pb-1.5 font-medium bn-text">মূল্য</th>
                <th className="text-right pb-1.5 font-medium bn-text">মোট</th>
              </tr>
            </thead>
            <tbody>
              {completed.items.map((item) => {
                const p =
                  completed.mode === "retail"
                    ? item.product.retailPrice
                    : item.product.wholesalePrice
                return (
                  <tr
                    key={item.product.id}
                    className="border-b border-frost-border/40"
                  >
                    <td className="py-1.5 bn-text">{item.product.nameBn}</td>
                    <td className="py-1.5 text-center text-frost-muted">
                      {item.qty}
                    </td>
                    <td className="py-1.5 text-right text-frost-muted">
                      {tk(p)}
                    </td>
                    <td className="py-1.5 text-right font-medium">
                      {tk(p * item.qty)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="space-y-1.5 border-t border-frost-border pt-3 text-sm">
            <div className="flex justify-between font-bold text-frost-dark">
              <span className="bn-text">মোট</span>
              <span>{tk(completed.total)}</span>
            </div>
            <div className="flex justify-between text-frost-muted">
              <span className="bn-text">নগদ প্রাপ্ত</span>
              <span>{tk(completed.cash)}</span>
            </div>
            <div className="flex justify-between text-frost-muted">
              <span className="bn-text">ফেরত</span>
              <span className="text-green-600 font-medium">
                {tk(completed.change)}
              </span>
            </div>
          </div>
          <div className="border-t border-dashed border-frost-border mt-4 pt-3 text-center text-xs text-frost-muted bn-text">
            ধন্যবাদ আসার জন্য! আবার আসবেন।
          </div>
        </div>
        <div className="mt-4 flex gap-3 no-print">
          <button
            onClick={() => window.print()}
            className="flex-1 bg-green-600 text-white rounded-xl py-3.5 font-bold text-base bn-text hover:bg-green-700 active:bg-green-800 transition-colors shadow-sm"
          >
            প্রিন্ট ক্যাশ মেমো
          </button>
          <button
            onClick={newSale}
            className="flex-1 bg-white border border-frost-border rounded-xl py-3.5 font-medium text-frost-dark hover:bg-frost-hover transition-colors bn-text"
          >
            নতুন বিক্রয়
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
      {/* Left */}
      <div className="space-y-3">
        {/* Mode */}
        <div className="flex items-center justify-between">
          <div className="inline-flex bg-frost-surface border border-frost-border rounded-lg p-0.5">
            {(["retail", "wholesale"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-5 py-1.5 rounded-md text-sm font-semibold bn-text transition-all ${
                  mode === m
                    ? "bg-white text-frost-dark shadow-sm"
                    : "text-frost-muted hover:text-frost-dark"
                }`}
              >
                {m === "retail" ? "খুচরা" : "পাইকারি"}
              </button>
            ))}
          </div>
          {mode === "wholesale" && (
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 bn-text">
              পাইকারি মূল্য চালু
            </span>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="পণ্যের নাম বা বারকোড লিখুন… / Name or barcode"
            aria-label="পণ্য খুঁজুন"
            className="w-full bg-white border-2 border-frost-border rounded-xl px-4 py-3 text-frost-dark placeholder-frost-muted focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 bn-text text-base transition-all"
            autoFocus
          />
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-20 bg-white border border-frost-border rounded-xl shadow-xl mt-1 overflow-hidden divide-y divide-frost-border/60">
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-frost-hover transition-colors text-left"
                >
                  <div>
                    <p className="font-semibold text-frost-dark bn-text">
                      {p.nameBn}
                    </p>
                    <p className="text-xs text-frost-muted mt-0.5">
                      {p.name} · {p.category} · স্টক:{" "}
                      <span
                        className={
                          p.stock <= 5 ? "text-amber-600 font-bold" : ""
                        }
                      >
                        {p.stock}
                      </span>
                    </p>
                  </div>
                  <div className="text-right ml-4 shrink-0">
                    <p className="font-bold tabular-nums text-frost-dark">
                      {tk(getPrice(p))}
                    </p>
                    {mode === "wholesale" && (
                      <p className="text-xs text-frost-muted line-through tabular-nums">
                        {tk(p.retailPrice)}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cart */}
        <div className="bg-white border border-frost-border rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-frost-surface border-b border-frost-border flex items-center justify-between">
            <span className="text-sm font-semibold text-frost-muted bn-text">
              কার্ট
            </span>
            {cart.length > 0 && (
              <button
                onClick={() => setCart([])}
                className="text-xs text-red-400 hover:text-red-600 transition-colors bn-text"
              >
                সব মুছুন
              </button>
            )}
          </div>
          {cart.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-frost-muted bn-text text-sm">কোনো পণ্য নেই</p>
              <p className="text-frost-muted/60 text-xs mt-1">
                উপরে সার্চ করে পণ্য যোগ করুন
              </p>
            </div>
          ) : (
            <div className="divide-y divide-frost-border/60">
              {cart.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-frost-surface/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-frost-dark truncate bn-text text-sm">
                      {item.product.nameBn}
                    </p>
                    <p className="text-xs text-frost-muted mt-0.5">
                      {tk(getPrice(item.product))} × {item.qty} ={" "}
                      <span className="tabular-nums">
                        {tk(getPrice(item.product) * item.qty)}
                      </span>
                    </p>
                    {isOwner && (
                      <p className="text-[11px] text-emerald-700 font-medium tabular-nums mt-0.5">
                        কেনা: {tk(item.product.purchasePrice)} (লাভ: +
                        {tk(
                          (getPrice(item.product) -
                            item.product.purchasePrice) *
                            item.qty,
                        )}
                        )
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => adjustQty(item.product.id, -1)}
                      aria-label="কমান"
                      className="w-7 h-7 rounded-full border border-frost-border flex items-center justify-center text-frost-muted hover:bg-frost-hover hover:text-frost-dark transition-colors text-sm font-bold"
                    >
                      −
                    </button>
                    <span className="w-7 text-center tabular-nums font-bold text-frost-dark text-sm">
                      {item.qty}
                    </span>
                    <button
                      onClick={() => adjustQty(item.product.id, 1)}
                      aria-label="বাড়ান"
                      className="w-7 h-7 rounded-full border border-frost-border flex items-center justify-center text-frost-muted hover:bg-frost-hover hover:text-frost-dark transition-colors text-sm font-bold"
                    >
                      +
                    </button>
                  </div>
                  <span className="w-20 text-right tabular-nums font-bold text-frost-dark text-sm shrink-0">
                    {tk(getPrice(item.product) * item.qty)}
                  </span>
                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    aria-label="সরান"
                    className="text-frost-muted hover:text-red-500 transition-colors text-sm px-1 shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right — Cash Panel */}
      <div className="bg-white border border-frost-border rounded-xl p-5 flex flex-col gap-4 h-fit sticky top-[70px]">
        <div className="text-center py-2">
          <p className="text-xs text-frost-muted uppercase tracking-widest bn-text mb-1">
            মোট পরিমাণ
          </p>
          <p className="text-5xl font-bold tabular-nums text-frost-dark">
            {tk(total)}
          </p>
          <p className="text-xs text-frost-muted mt-1">{cart.length} আইটেম</p>
          {isOwner && cart.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-frost-border/60 text-xs text-emerald-800 bg-emerald-50 rounded-lg p-2.5">
              <div className="flex justify-between font-medium">
                <span className="bn-text">মোট কেনা খরচ:</span>
                <span className="tabular-nums font-bold">
                  {tk(
                    cart.reduce(
                      (s, i) => s + i.product.purchasePrice * i.qty,
                      0,
                    ),
                  )}
                </span>
              </div>
              <div className="flex justify-between font-bold text-emerald-700 mt-1">
                <span className="bn-text">মোট গ্রস প্রফিট:</span>
                <span className="tabular-nums">
                  +
                  {tk(
                    total -
                      cart.reduce(
                        (s, i) => s + i.product.purchasePrice * i.qty,
                        0,
                      ),
                  )}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-frost-border pt-4">
          <label
            htmlFor="cashInput"
            className="block text-sm font-medium text-frost-muted bn-text mb-1.5"
          >
            নগদ প্রাপ্ত (৳)
          </label>
          <input
            id="cashInput"
            type="number"
            value={cashReceived}
            onChange={(e) => setCashReceived(e.target.value)}
            placeholder="০"
            min="0"
            className={`w-full border-2 rounded-xl px-4 py-3 text-2xl tabular-nums font-bold focus:outline-none transition-all ${
              insufficient
                ? "border-red-400 text-red-600 focus:border-red-400 focus:ring-2 focus:ring-red-500/20"
                : "border-frost-border text-frost-dark focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
            }`}
          />
          {insufficient && (
            <p className="text-red-500 text-xs mt-1.5 bn-text">
              অপর্যাপ্ত নগদ — আরও {tk(total - cashNum)} দরকার
            </p>
          )}
        </div>

        {quickAmounts.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {quickAmounts.map((amt) => (
              <button
                key={amt}
                onClick={() => setCashReceived(String(amt))}
                className="border border-frost-border rounded-lg py-2 text-sm tabular-nums font-semibold text-frost-dark hover:bg-frost-hover hover:border-green-400 transition-all"
              >
                {tk(amt)}
              </button>
            ))}
          </div>
        )}

        {cashReceived !== "" && !insufficient && cashNum >= total && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
            <p className="text-xs text-green-600 bn-text font-medium">
              ফেরত দিন
            </p>
            <p className="text-3xl font-bold tabular-nums text-green-700">
              {tk(change)}
            </p>
          </div>
        )}

        <button
          onClick={completeSale}
          disabled={!canComplete}
          className="w-full bg-green-600 text-white rounded-xl py-4 font-bold text-lg bn-text hover:bg-green-700 active:bg-green-800 transition-colors disabled:opacity-35 disabled:cursor-not-allowed shadow-sm mt-1"
        >
          প্রিন্ট ক্যাশ মেমো
        </button>
        <p className="text-center text-xs text-frost-muted -mt-2">
          Complete Sale &amp; Print Bill
        </p>
      </div>
    </div>
  )
}

// ─── Product Entry ─────────────────────────────────────────────────
type ProductForm = {
  name: string
  nameBn: string
  category: string
  purchasePrice: string
  retailPrice: string
  wholesalePrice: string
  stock: string
}

const EMPTY_FORM: ProductForm = {
  name: "",
  nameBn: "",
  category: "",
  purchasePrice: "",
  retailPrice: "",
  wholesalePrice: "",
  stock: "",
}

function ProductEntry({ onAdd }: { onAdd: (p: Product) => void }) {
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<ProductForm>>({})
  const [savedProduct, setSavedProduct] = useState<Product | null>(null)

  const set = (k: keyof ProductForm, v: string) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => ({ ...e, [k]: "" }))
  }

  const validate = (): boolean => {
    const e: Partial<ProductForm> = {}
    if (!form.nameBn.trim()) e.nameBn = "বাংলা নাম দিন"
    if (!form.name.trim()) e.name = "English name required"
    if (!form.category.trim()) e.category = "ক্যাটাগরি দিন"
    if (
      !form.purchasePrice ||
      isNaN(+form.purchasePrice) ||
      +form.purchasePrice <= 0
    )
      e.purchasePrice = "সঠিক মূল্য দিন"
    if (!form.retailPrice || isNaN(+form.retailPrice) || +form.retailPrice <= 0)
      e.retailPrice = "সঠিক মূল্য দিন"
    if (
      !form.wholesalePrice ||
      isNaN(+form.wholesalePrice) ||
      +form.wholesalePrice <= 0
    )
      e.wholesalePrice = "সঠিক মূল্য দিন"
    if (!form.stock || isNaN(+form.stock) || +form.stock < 0)
      e.stock = "সঠিক পরিমাণ দিন"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    const newBarcode = "8901" + Date.now().toString().slice(-9)
    const p: Product = {
      id: "P" + Date.now(),
      name: form.name.trim(),
      nameBn: form.nameBn.trim(),
      category: form.category.trim(),
      purchasePrice: +form.purchasePrice,
      retailPrice: +form.retailPrice,
      wholesalePrice: +form.wholesalePrice,
      stock: +form.stock,
      barcode: newBarcode,
    }
    onAdd(p)
    setSavedProduct(p)
    setForm(EMPTY_FORM)
    setTimeout(() => setSavedProduct(null), 5000)
  }

  const previewBarcode = "8901312345678"
  const previewName = form.nameBn || "পণ্যের নাম"
  const previewPrice = form.retailPrice ? +form.retailPrice : null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6 items-start">
      <div className="bg-white border border-frost-border rounded-xl p-6 space-y-5">
        <h2 className="font-bold text-frost-dark bn-text text-xl border-b border-frost-border pb-4">
          নতুন পণ্য এন্ট্রি
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-frost-muted bn-text mb-1.5">
              পণ্যের নাম — বাংলা *
            </label>
            <input
              value={form.nameBn}
              onChange={(e) => set("nameBn", e.target.value)}
              placeholder="যেমন: মিনিকেট চাল"
              className={`field ${errors.nameBn ? "border-red-400" : ""}`}
            />
            {errors.nameBn && (
              <p className="text-red-500 text-xs mt-1 bn-text">
                {errors.nameBn}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-frost-muted mb-1.5">
              Product Name — English *
            </label>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Miniket Rice"
              className={`field ${errors.name ? "border-red-400" : ""}`}
            />
            {errors.name && (
              <p className="text-red-500 text-xs mt-1">{errors.name}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-frost-muted bn-text mb-1.5">
              ক্যাটাগরি *
            </label>
            <input
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              placeholder="যেমন: চাল, ডাল, তেল, মশলা"
              className={`field ${errors.category ? "border-red-400" : ""}`}
            />
            {errors.category && (
              <p className="text-red-500 text-xs mt-1 bn-text">
                {errors.category}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-frost-muted bn-text mb-1.5">
              প্রারম্ভিক স্টক *
            </label>
            <input
              type="number"
              min="0"
              value={form.stock}
              onChange={(e) => set("stock", e.target.value)}
              placeholder="০"
              className={`field ${errors.stock ? "border-red-400" : ""}`}
            />
            {errors.stock && (
              <p className="text-red-500 text-xs mt-1 bn-text">
                {errors.stock}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-frost-muted bn-text mb-1.5">
              ক্রয় মূল্য (৳) *
            </label>
            <input
              type="number"
              min="0"
              value={form.purchasePrice}
              onChange={(e) => set("purchasePrice", e.target.value)}
              placeholder="০.০০"
              className={`field ${
                errors.purchasePrice ? "border-red-400" : ""
              }`}
            />
            {errors.purchasePrice && (
              <p className="text-red-500 text-xs mt-1 bn-text">
                {errors.purchasePrice}
              </p>
            )}
            {form.purchasePrice &&
              form.retailPrice &&
              +form.retailPrice <= +form.purchasePrice && (
                <p className="text-amber-600 text-xs mt-1 bn-text">
                  সতর্কতা: খুচরা মূল্য ক্রয় মূল্যের চেয়ে বেশি হওয়া উচিত
                </p>
              )}
          </div>
          <div>
            <label className="block text-sm font-medium text-frost-muted bn-text mb-1.5">
              খুচরা মূল্য (৳) *
            </label>
            <input
              type="number"
              min="0"
              value={form.retailPrice}
              onChange={(e) => set("retailPrice", e.target.value)}
              placeholder="০.০০"
              className={`field ${errors.retailPrice ? "border-red-400" : ""}`}
            />
            {errors.retailPrice && (
              <p className="text-red-500 text-xs mt-1 bn-text">
                {errors.retailPrice}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-frost-muted bn-text mb-1.5">
              পাইকারি মূল্য (৳) *
            </label>
            <input
              type="number"
              min="0"
              value={form.wholesalePrice}
              onChange={(e) => set("wholesalePrice", e.target.value)}
              placeholder="০.০০"
              className={`field ${
                errors.wholesalePrice ? "border-red-400" : ""
              }`}
            />
            {errors.wholesalePrice && (
              <p className="text-red-500 text-xs mt-1 bn-text">
                {errors.wholesalePrice}
              </p>
            )}
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={handleSave}
            className="w-full bg-green-600 text-white rounded-xl py-3.5 font-bold bn-text text-base hover:bg-green-700 active:bg-green-800 transition-colors shadow-sm"
          >
            সেভ করুন ও বারকোড স্টিকার প্রিন্ট করুন
          </button>
        </div>

        {savedProduct && (
          <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
            <span className="text-green-600 text-xl mt-0.5">✓</span>
            <div>
              <p className="font-semibold text-green-800 bn-text">
                পণ্য সেভ হয়েছে!
              </p>
              <p className="text-green-700 text-sm bn-text">
                {savedProduct.nameBn} — স্টক: {savedProduct.stock}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Barcode preview */}
      <div className="bg-white border border-frost-border rounded-xl p-5 space-y-4 sticky top-[70px]">
        <h3 className="text-sm font-semibold text-frost-muted bn-text border-b border-frost-border pb-3">
          বারকোড স্টিকার প্রিভিউ
        </h3>
        <div className="border-2 border-dashed border-frost-border rounded-lg p-4 text-center bg-frost-surface/40">
          <p className="text-sm font-bold text-frost-dark bn-text mb-2 leading-tight">
            {previewName}
          </p>
          <BarcodeViz code={previewBarcode} />
          <p className="text-xs text-frost-muted font-mono tracking-widest mt-2">
            {previewBarcode}
          </p>
          <p className="text-base font-bold tabular-nums text-frost-dark mt-1.5">
            {previewPrice !== null ? tk(previewPrice) : "৳ —"}
          </p>
        </div>
        <p className="text-xs text-frost-muted text-center bn-text">
          আকার: ৪০মিমি × ২৫মিমি
        </p>
        <div className="text-xs text-frost-muted space-y-1 bn-text border-t border-frost-border pt-3">
          <p>• সকল ক্ষেত্র পূরণ করুন</p>
          <p>• সেভ করলে স্টকে যোগ হবে</p>
          <p>• বারকোড স্বয়ংক্রিয়ভাবে তৈরি হবে</p>
        </div>
      </div>
    </div>
  )
}

function Inventory({
  products,
  isOwner = false,
}: {
  products: Product[]
  isOwner?: boolean
}) {
  const [search, setSearch] = useState("")

  const filtered = products.filter(
    (p) =>
      !search ||
      p.nameBn.includes(search) ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.includes(search),
  )

  const totalValue = products.reduce((s, p) => s + p.stock * p.purchasePrice, 0)
  const lowCount = products.filter((p) => p.stock <= 5).length

  const printLabel = (p: Product) => {
    const bars = p.barcode
      .replace(/\D/g, "")
      .padEnd(13, "0")
      .slice(0, 13)
      .split("")
      .map(Number)
    const barsHtml = bars
      .map(
        (d) =>
          `<div style="width:${
            d % 3 === 0 ? 2 : 3
          }px;height:${28 + (d % 4) * 2}px;background:#000;display:inline-block;margin:0 0.5px"></div>`,
      )
      .join("")
    const win = window.open("", "_blank", "width=300,height=240")
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><title>Barcode</title>
      <style>body{font-family:monospace;text-align:center;padding:16px;margin:0}
      .name{font-size:12px;font-weight:bold;margin-bottom:6px}
      .bars{display:flex;justify-content:center;align-items:flex-end;margin:6px 0;height:44px}
      .code{font-size:8px;letter-spacing:1.5px;color:#555;margin-bottom:4px}
      .price{font-size:16px;font-weight:bold}</style></head>
      <body onload="window.print();window.close()">
      <div class="name">${p.nameBn}</div>
      <div class="bars">${barsHtml}</div>
      <div class="code">${p.barcode}</div>
      <div class="price">৳${p.retailPrice}</div>
      </body></html>`)
    win.document.close()
  }

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "মোট পণ্য",
            labelEn: "Total Items",
            value: products.length.toString(),
            unit: "",
          },
          {
            label: "কম স্টক",
            labelEn: "Low Stock",
            value: lowCount.toString(),
            unit: "টি",
            warn: lowCount > 0,
          },
          {
            label: "স্টক মূল্য",
            labelEn: "Stock Value",
            value: isOwner ? tk(totalValue) : "🔒 গোপন",
            unit: "",
          },
        ].map((s) => (
          <div
            key={s.label}
            className={`bg-white border rounded-xl p-4 ${
              s.warn ? "border-amber-300 bg-amber-50/60" : "border-frost-border"
            }`}
          >
            <p className="text-xs text-frost-muted bn-text">{s.label}</p>
            <p
              className={`text-xl font-bold tabular-nums mt-1 ${
                s.warn ? "text-amber-700" : "text-frost-dark"
              }`}
            >
              {s.value}
              {s.unit}
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="পণ্য খুঁজুন… / Search"
          className="flex-1 bg-white border border-frost-border rounded-xl px-4 py-2.5 text-frost-dark placeholder-frost-muted focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 bn-text transition-all"
        />
        <span className="text-sm text-frost-muted whitespace-nowrap">
          {filtered.length} পণ্য
        </span>
      </div>

      <div className="bg-white border border-frost-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-frost-surface border-b border-frost-border text-xs text-frost-muted">
              <th className="text-left px-4 py-3 font-semibold bn-text">পণ্য</th>
              <th className="text-left px-3 py-3 font-semibold bn-text hidden sm:table-cell">
                ক্যাটাগরি
              </th>
              <th className="text-right px-3 py-3 font-semibold bn-text">
                স্টক
              </th>
              <th className="text-right px-3 py-3 font-semibold bn-text hidden md:table-cell">
                খুচরা
              </th>
              <th className="text-right px-3 py-3 font-semibold bn-text hidden md:table-cell">
                পাইকারি
              </th>
              {isOwner && (
                <th className="text-right px-3 py-3 font-semibold bn-text hidden lg:table-cell text-emerald-800">
                  কেনা দাম
                </th>
              )}
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-frost-border/60">
            {filtered.map((p) => {
              const low = p.stock <= 5
              return (
                <tr
                  key={p.id}
                  className={`transition-colors ${
                    low
                      ? "bg-yellow-50 hover:bg-yellow-100/70"
                      : "hover:bg-frost-surface/60"
                  }`}
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-frost-dark bn-text text-sm">
                      {p.nameBn}
                    </p>
                    <p className="text-xs text-frost-muted mt-0.5">{p.name}</p>
                  </td>
                  <td className="px-3 py-3 text-sm text-frost-muted bn-text hidden sm:table-cell">
                    {p.category}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span
                      className={`tabular-nums font-bold text-sm ${
                        low ? "text-amber-700" : "text-frost-dark"
                      }`}
                    >
                      {p.stock}
                      {low && (
                        <span className="ml-1 text-xs text-amber-500 bn-text font-normal">
                          ↓
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-sm text-frost-dark hidden md:table-cell">
                    {tk(p.retailPrice)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-sm text-frost-muted hidden md:table-cell">
                    {tk(p.wholesalePrice)}
                  </td>
                  {isOwner && (
                    <td className="px-3 py-3 text-right tabular-nums text-sm text-emerald-700 font-semibold hidden lg:table-cell">
                      {tk(p.purchasePrice)}
                    </td>
                  )}
                  <td className="px-3 py-3">
                    <button
                      onClick={() => printLabel(p)}
                      className="text-xs border border-frost-border rounded-lg px-3 py-1.5 text-frost-muted hover:text-frost-dark hover:bg-frost-hover transition-colors bn-text whitespace-nowrap cursor-pointer"
                    >
                      স্টিকার
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-frost-muted bn-text">কোনো পণ্য পাওয়া যায়নি</p>
          </div>
        )}
      </div>
      <p className="text-xs text-frost-muted bn-text flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 bg-yellow-100 border border-yellow-300 rounded-sm"></span>
        হলুদ সারি = কম স্টক (৫ বা তার কম)
      </p>
    </div>
  )
}

// ─── Baki Ledger ───────────────────────────────────────────────────
function BakiLedger() {
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS)
  const [search, setSearch] = useState("")
  const [payDialog, setPayDialog] = useState<Customer | null>(null)
  const [payAmount, setPayAmount] = useState("")
  const [payError, setPayError] = useState("")

  const filtered = customers.filter(
    (c) =>
      !search ||
      c.nameBn.includes(search) ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      c.village.includes(search),
  )

  const totalDue = customers.reduce((s, c) => s + c.due, 0)
  const debtors = customers.filter((c) => c.due > 0).length

  const openPayDialog = (c: Customer) => {
    setPayDialog(c)
    setPayAmount("")
    setPayError("")
  }

  const recordPayment = () => {
    if (!payDialog) return
    const amt = parseFloat(payAmount)
    if (!payAmount || isNaN(amt) || amt <= 0) {
      setPayError("সঠিক পরিমাণ লিখুন")
      return
    }
    if (amt > payDialog.due) {
      setPayError(`সর্বোচ্চ ${tk(payDialog.due)} পরিশোধ করা যাবে`)
      return
    }
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === payDialog.id ? { ...c, due: +(c.due - amt).toFixed(2) } : c,
      ),
    )
    setPayDialog(null)
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-red-200 rounded-xl p-4 bg-red-50/40">
          <p className="text-xs text-red-400 bn-text">মোট বাকি</p>
          <p className="text-2xl font-bold tabular-nums text-red-600 mt-1">
            {tk(totalDue)}
          </p>
        </div>
        <div className="bg-white border border-frost-border rounded-xl p-4">
          <p className="text-xs text-frost-muted bn-text">বকেয়া গ্রাহক</p>
          <p className="text-2xl font-bold tabular-nums text-frost-dark mt-1">
            {debtors} জন
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="নাম, ফোন বা গ্রাম লিখুন… / Search"
          className="flex-1 bg-white border border-frost-border rounded-xl px-4 py-2.5 text-frost-dark placeholder-frost-muted focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 bn-text transition-all"
        />
      </div>

      <div className="bg-white border border-frost-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-frost-surface border-b border-frost-border text-xs text-frost-muted">
              <th className="text-left px-4 py-3 font-semibold bn-text">নাম</th>
              <th className="text-left px-3 py-3 font-semibold bn-text hidden sm:table-cell">
                ফোন
              </th>
              <th className="text-left px-3 py-3 font-semibold bn-text hidden md:table-cell">
                গ্রাম
              </th>
              <th className="text-right px-3 py-3 font-semibold bn-text">
                বাকি পরিমাণ
              </th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-frost-border/60">
            {filtered.map((c) => (
              <tr
                key={c.id}
                className={`transition-colors ${
                  c.due > 0 ? "hover:bg-red-50/40" : "hover:bg-frost-surface/60"
                }`}
              >
                <td className="px-4 py-3">
                  <p className="font-semibold text-frost-dark bn-text">
                    {c.nameBn}
                  </p>
                  <p className="text-xs text-frost-muted mt-0.5">{c.name}</p>
                </td>
                <td
                  className="px-3 py-3 text-sm text-frost-muted hidden sm:table-cell"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {c.phone}
                </td>
                <td className="px-3 py-3 text-sm text-frost-muted bn-text hidden md:table-cell">
                  {c.village}
                </td>
                <td className="px-3 py-3 text-right">
                  {c.due > 0 ? (
                    <span className="tabular-nums font-bold text-red-600 text-base">
                      {tk(c.due)}
                    </span>
                  ) : (
                    <span className="text-green-600 text-sm bn-text font-medium">
                      পরিশোধিত ✓
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-right">
                  {c.due > 0 && (
                    <button
                      onClick={() => openPayDialog(c)}
                      className="text-xs border border-frost-border rounded-lg px-3 py-1.5 text-frost-muted hover:text-frost-dark hover:bg-frost-hover transition-colors bn-text"
                    >
                      পরিশোধ
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-frost-muted bn-text">কোনো তথ্য পাওয়া যায়নি</p>
          </div>
        )}
      </div>

      {/* Payment Dialog */}
      {payDialog && (
        <div className="fixed inset-0 bg-black/25 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-frost-border rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-frost-dark bn-text text-xl mb-0.5">
              {payDialog.nameBn}
            </h3>
            <p className="text-sm text-frost-muted mb-1">
              {payDialog.phone} ·{" "}
              <span className="bn-text">{payDialog.village}</span>
            </p>
            <div className="flex items-baseline gap-2 mb-5">
              <span className="text-sm text-frost-muted bn-text">মোট বাকি:</span>
              <span className="text-2xl font-bold tabular-nums text-red-600">
                {tk(payDialog.due)}
              </span>
            </div>

            <label
              htmlFor="payInput"
              className="block text-sm font-medium text-frost-muted bn-text mb-1.5"
            >
              পরিশোধের পরিমাণ (৳)
            </label>
            <input
              id="payInput"
              type="number"
              value={payAmount}
              onChange={(e) => {
                setPayAmount(e.target.value)
                setPayError("")
              }}
              placeholder="০"
              min="0"
              max={payDialog.due}
              autoFocus
              className={`w-full border-2 rounded-xl px-4 py-3 text-2xl tabular-nums font-bold focus:outline-none transition-all mb-1.5 ${
                payError
                  ? "border-red-400 focus:border-red-400"
                  : "border-frost-border focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
              }`}
            />
            {payError && (
              <p className="text-red-500 text-xs mb-3 bn-text">{payError}</p>
            )}

            <div className="grid grid-cols-3 gap-2 mb-5">
              {[payDialog.due * 0.5, payDialog.due * 0.75, payDialog.due].map(
                (amt, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setPayAmount(String(Math.round(amt)))
                      setPayError("")
                    }}
                    className="border border-frost-border rounded-lg py-2 text-xs tabular-nums text-frost-muted hover:bg-frost-hover hover:text-frost-dark transition-colors font-medium"
                  >
                    {tk(Math.round(amt))}
                  </button>
                ),
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setPayDialog(null)}
                className="flex-1 border border-frost-border rounded-xl py-3 text-frost-muted hover:bg-frost-hover transition-colors bn-text font-medium"
              >
                বাতিল
              </button>
              <button
                onClick={recordPayment}
                className="flex-1 bg-green-600 text-white rounded-xl py-3 font-bold hover:bg-green-700 active:bg-green-800 transition-colors bn-text shadow-sm"
              >
                নিশ্চিত করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── App Shell ────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState<NavigationTab>("pos")
  const [isOwner, setIsOwner] = useState(false)
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS)

  const addProduct = (p: Product) => setProducts((prev) => [...prev, p])
  const updateProducts = (fn: (p: Product[]) => Product[]) => setProducts(fn)

  return (
    <div className="min-h-screen bg-frost-bg">
      <Navbar
        activeTab={tab}
        onTabChange={setTab}
        isOwner={isOwner}
        onToggleOwner={setIsOwner}
      />

      {/* Main */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-5">
        {tab === "pos" && <PosCounter isOwner={isOwner} />}
        {tab === "inventory" && (
          <div className="space-y-6">
            <Inventory products={products} isOwner={isOwner} />
            <div className="pt-5 border-t border-frost-border">
              <h3 className="text-base font-bold text-frost-dark bn-text mb-3">
                নতুন পণ্য ক্যাটালগ এন্ট্রি (Product Entry)
              </h3>
              <ProductEntry onAdd={addProduct} />
            </div>
          </div>
        )}
        {tab === "customers" && <BakiLedger />}
        {tab === "dashboard" && (
          <div className="bg-white border border-frost-border rounded-2xl p-10 text-center shadow-xs">
            <div className="text-4xl mb-3">📊</div>
            <h2 className="text-xl font-bold text-frost-dark bn-text">
              ড্যাশবোর্ড ও বিশ্লেষণ (Analytics)
            </h2>
            <p className="text-sm text-frost-muted mt-2 bn-text max-w-md mx-auto">
              আজকের মোট বিক্রয়, গ্রস প্রফিট, বাকির খাতা ও মেয়াদোত্তীর্ণ পণ্যের পূর্ণাঙ্গ
              বিশ্লেষণ মডিউল।
            </p>
          </div>
        )}
        {tab === "godown" && (
          <div className="bg-white border border-frost-border rounded-2xl p-10 text-center shadow-xs">
            <div className="text-4xl mb-3">🏭</div>
            <h2 className="text-xl font-bold text-frost-dark bn-text">
              গুদাম ও চালান ব্যবস্থাপনা (Godown & Challan)
            </h2>
            <p className="text-sm text-frost-muted mt-2 bn-text max-w-md mx-auto">
              সিনজেনটা চালান থেকে মাল আনলোড, কার্টন থেকে বেস ইউনিট ভাঙা এবং গুদাম থেকে
              দোকানে স্টক স্থানান্তর।
            </p>
          </div>
        )}
        {tab === "returns" && (
          <div className="bg-white border border-frost-border rounded-2xl p-10 text-center shadow-xs">
            <div className="text-4xl mb-3">🔄</div>
            <h2 className="text-xl font-bold text-frost-dark bn-text">
              পণ্য ফেরত কাউন্টার (Sales Return Counter)
            </h2>
            <p className="text-sm text-frost-muted mt-2 bn-text max-w-md mx-auto">
              বিনা রশিদে অথবা মেমো নম্বর দিয়ে অবিক্রীত/ক্ষতিগ্রস্ত কীটনাশক ফেরত গ্রহণ ও
              বাকির খাতায় স্বয়ংক্রিয় সমন্বয়।
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
