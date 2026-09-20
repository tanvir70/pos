import { useState, type FormEvent } from "react"
import { Sprout, User, Lock, Eye, EyeOff, ArrowRight } from "lucide-react"
import { useAuth } from "../context/AuthContext"

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
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between items-center px-4 py-8 sm:py-12 relative overflow-hidden">
      {/* Subtle brand tint on clean slate */}
      <div
        className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-emerald-100/40 via-slate-50/40 to-transparent pointer-events-none"
        aria-hidden="true"
      />

      {/* Spacer for vertical balance */}
      <div className="w-full max-w-sm hidden sm:block" />

      {/* Main Minimalist Card */}
      <div className="w-full max-w-[390px] relative z-10 my-auto">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white flex items-center justify-center shadow-md shadow-emerald-700/15 ring-1 ring-emerald-500/20 mb-3.5">
            <Sprout className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Rajib Enterprise
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Agrochemical Dealership Cockpit
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-7 sm:p-8 shadow-xs">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  autoComplete="username"
                  autoFocus
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value)
                    if (error) setError(null)
                  }}
                  disabled={isLoggingIn}
                  placeholder="Username"
                  className="w-full pl-10 pr-3.5 py-2 rounded-xl bg-slate-50/60 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (error) setError(null)
                  }}
                  disabled={isLoggingIn}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2 rounded-xl bg-slate-50/60 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-2.5 bg-rose-50 border border-rose-200/80 rounded-xl text-rose-700 text-xs font-semibold">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full mt-2 py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoggingIn ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Signing in...</span>
                </div>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Helper */}
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>Demo: owner / owner123</span>
            <button
              type="button"
              onClick={() => {
                setUsername("owner")
                setPassword("owner123")
                setError(null)
              }}
              className="text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer"
            >
              Auto Fill
            </button>
          </div>
        </div>
      </div>

      {/* Clean Subtle Footer */}
      <footer className="text-center text-xs text-slate-400 relative z-10">
        &copy; {new Date().getFullYear()} Rajib Enterprise. All rights reserved.
      </footer>
    </div>
  )
}
