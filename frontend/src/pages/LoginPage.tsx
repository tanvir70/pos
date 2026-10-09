import { useState, type FormEvent } from "react"
import {
  Sprout,
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Activity,
  Warehouse,
  Receipt,
  FileSpreadsheet,
  AlertCircle,
} from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { STORE_INFO } from "../constants/store"
import BrandLogo from "../components/ui/BrandLogo"

export default function LoginPage() {
  const { login, isLoggingIn } = useAuth()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError("Please enter both username and password")
      return
    }
    setError(null)
    const ok = await login(username, password)
    if (!ok) {
      setError("Invalid username or password")
      setPassword("")
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden select-none font-sans">
      {/* Ambient background glows */}
      <div
        className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-600/15 rounded-full blur-[128px] pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute top-1/2 -right-40 w-[32rem] h-[32rem] bg-teal-500/10 rounded-full blur-[140px] pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-40 left-1/3 w-96 h-96 bg-emerald-700/10 rounded-full blur-[128px] pointer-events-none"
        aria-hidden="true"
      />

      {/* Subtle geometric dot grid pattern */}
      <div
        className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:28px_28px] opacity-[0.07] pointer-events-none"
        aria-hidden="true"
      />

      {/* Spacer for desktop vertical balance */}
      <div className="w-full max-w-sm hidden lg:block" />

      {/* Main Glassmorphic Console Card */}
      <main className="relative z-10 w-full max-w-5xl mx-auto px-4 py-8 sm:py-12 my-auto">
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-2xl shadow-2xl shadow-black/80 overflow-hidden ring-1 ring-white/10 grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
          {/* Left Column: Brand & Operational Identity */}
          <div className="lg:col-span-7 p-8 sm:p-10 lg:p-12 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800/80 bg-gradient-to-br from-slate-900/95 via-slate-900/75 to-emerald-950/40 relative overflow-hidden">
            {/* Subtle corner sheen */}
            <div
              className="absolute -right-20 -bottom-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"
              aria-hidden="true"
            />

            <div>
              {/* Dealership Crest & Live Indicator */}
              <div className="flex items-center justify-between gap-3 mb-6">
                <BrandLogo size="lg" variant="image" className="shrink-0" />
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold tracking-wide">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span>Terminal Node Live</span>
                </div>
              </div>

              {/* Title & Bengali Descriptor */}
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {STORE_INFO.name}
                </h1>
                <p className="text-sm font-medium text-emerald-400/90 mt-1">
                  মেসার্স রাজীব এন্টারপ্রাইজ • Agrochemical Cockpit
                </p>
                <p className="text-xs text-slate-400 mt-2 font-mono">
                  Authorized Syngenta Dealership • Pesticide Ordinance 1971 Compliant
                </p>
              </div>

              {/* Feature Highlights */}
              <div className="mt-8 space-y-4">
                <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-slate-800/40 border border-slate-700/40 hover:border-slate-700 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Warehouse className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-slate-200">
                      Multi-Location Stock Control
                    </h2>
                    <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                      Dokan counter, Godown bulk storage & Quarantine segregation with strict FEFO batch tracking.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-slate-800/40 border border-slate-700/40 hover:border-slate-700 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-slate-200">
                      Instant Counter POS & Invoicing
                    </h2>
                    <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                      Rapid barcode scanner entry, wholesale margins, mixed cash/digital tender & 80mm ESC/POS thermal slips.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-slate-800/40 border border-slate-700/40 hover:border-slate-700 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-slate-200">
                      Audit-Grade Customer Khata
                    </h2>
                    <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                      Guaranteed non-negative dues, ledger history statements & safe customer return adjustments.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Left Footer System Meta */}
            <div className="pt-6 mt-6 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-medium">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>Production Environment</span>
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Asia/Dhaka (BST)
              </span>
            </div>
          </div>

          {/* Right Column: Sign-In Experience */}
          <div className="lg:col-span-5 p-8 sm:p-10 lg:p-12 flex flex-col justify-between bg-slate-900/40 backdrop-blur-xl">
            <div className="my-auto">
              <div className="mb-6">
                <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-1">
                  Security Gateway
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Operator Sign In
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Enter authorized dealership credentials to unlock the terminal.
                </p>
              </div>

              <form id="login-form" onSubmit={handleSubmit} className="space-y-4">
                {/* Username Input */}
                <div>
                  <label
                    htmlFor="username-input"
                    className="block text-xs font-semibold text-slate-300 mb-1.5"
                  >
                    Username
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      id="username-input"
                      type="text"
                      autoComplete="username"
                      autoFocus
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value)
                        if (error) setError(null)
                      }}
                      disabled={isLoggingIn}
                      placeholder="Enter username"
                      className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-800/80 border border-slate-700/80 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <label
                    htmlFor="password-input"
                    className="block text-xs font-semibold text-slate-300 mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="password-input"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        if (error) setError(null)
                      }}
                      disabled={isLoggingIn}
                      placeholder="••••••••••••"
                      className="w-full h-11 pl-10 pr-11 rounded-xl bg-slate-800/80 border border-slate-700/80 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-mono transition-all disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3.5 p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer rounded-lg hover:bg-slate-700/50"
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-2.5 animate-in fade-in duration-200">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full h-11 mt-2 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-bold shadow-lg shadow-emerald-700/25 flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer disabled:opacity-50 active:scale-[0.99]"
                >
                  {isLoggingIn ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to Terminal</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* In-Card Security Guarantee */}
            <div className="mt-8 pt-5 border-t border-slate-800/70 flex items-center justify-center gap-2 text-slate-400 text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Authorized personnel only • 256-bit encrypted</span>
            </div>
          </div>
        </div>
      </main>

      {/* Premium Footer with Explicit Gridmark Labs Notice */}
      <footer className="relative z-10 py-6 text-center text-xs text-slate-400 flex flex-col items-center gap-1">
        <p className="font-semibold text-slate-300 tracking-wide text-xs">
          All right reserve for Gridmark Labs.
        </p>
        <p className="text-[11px] text-slate-400 flex items-center gap-2">
          <span>{STORE_INFO.name} POS Terminal</span>
          <span>•</span>
          <span>Engineered by Gridmark Labs</span>
          <span>•</span>
          <span>&copy; {new Date().getFullYear()}</span>
        </p>
      </footer>
    </div>
  )
}
