import { useState, type FormEvent } from "react"
import { Sprout, User, Lock, Eye, EyeOff, LogIn } from "lucide-react"
import { useAuth } from "../context/AuthContext"
import Button from "../components/ui/Button"
import Input from "../components/ui/Input"

export default function LoginPage() {
  const { login, isLoggingIn } = useAuth()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError("Enter both username and password")
      return
    }
    setError(null)
    const ok = await login(username, password)
    if (!ok) {
      setError("Invalid username or password. Please try again.")
      setPassword("")
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-700 text-white flex items-center justify-center shadow-sm">
            <Sprout className="w-7 h-7" />
          </div>
          <h1 className="mt-3 text-xl font-bold text-slate-900 tracking-tight">
            Al-Amin Traders
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Agrochemical Dealership Cockpit
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-6">
          <h2 className="text-base font-bold text-slate-900 mb-4">Sign In</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Username"
              type="text"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                if (error) setError(null)
              }}
              placeholder="e.g. owner"
              leftAdornment={<User className="w-4 h-4" />}
              disabled={isLoggingIn}
            />

            <Input
              label="Password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (error) setError(null)
              }}
              placeholder="••••••••"
              leftAdornment={<Lock className="w-4 h-4" />}
              rightAdornment={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="pointer-events-auto text-slate-400 hover:text-slate-600 cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
              disabled={isLoggingIn}
            />

            {error && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-semibold animate-in fade-in">
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isLoggingIn}
              leftIcon={!isLoggingIn ? <LogIn className="w-4 h-4" /> : undefined}
            >
              Sign In
            </Button>
          </form>
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-5">
          Default account &mdash; <span className="font-mono">owner / owner123</span>
        </p>
      </div>
    </div>
  )
}
