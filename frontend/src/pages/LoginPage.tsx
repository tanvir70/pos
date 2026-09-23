import { useState, type FormEvent } from "react"
import { Sprout, User, Lock, Eye, EyeOff, ArrowRight } from "lucide-react"
import { useAuth } from "../context/AuthContext"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../components/ui/Card"
import Input from "../components/ui/Input"
import Button from "../components/ui/Button"
import Badge from "../components/ui/Badge"
import { Separator } from "../components/ui/separator"

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
      <div className="w-full max-w-[400px] relative z-10 my-auto">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white flex items-center justify-center shadow-md shadow-emerald-700/15 ring-1 ring-emerald-500/20 mb-3.5">
            <Sprout className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Rajib Enterprise
          </h1>
          <div className="mt-1 flex items-center gap-1.5">
            <Badge variant="emerald" className="text-[10px] uppercase font-bold tracking-wide">
              Agrochemical Dealership Cockpit
            </Badge>
          </div>
        </div>

        {/* Auth Card using shadcn Card */}
        <Card className="shadow-xs border-slate-200/90 rounded-2xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg font-bold text-slate-900">Sign In</CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Enter your credentials to access the POS terminal and inventory
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <form id="login-form" onSubmit={handleSubmit} className="space-y-4">
              {/* Username Input */}
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
                disabled={isLoggingIn}
                placeholder="Username"
                leftAdornment={<User className="w-4 h-4" />}
                inputSize="md"
              />

              {/* Password Input */}
              <div className="relative">
                <Input
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (error) setError(null)
                  }}
                  disabled={isLoggingIn}
                  placeholder="••••••••"
                  isMonospace
                  leftAdornment={<Lock className="w-4 h-4" />}
                  inputSize="md"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-[32px] text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-2.5 bg-rose-50 border border-rose-200/80 rounded-xl text-rose-700 text-xs font-semibold">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                disabled={isLoggingIn}
                isLoading={isLoggingIn}
                rightIcon={!isLoggingIn ? <ArrowRight className="w-4 h-4" /> : undefined}
                className="mt-2 font-bold cursor-pointer"
              >
                Sign In
              </Button>
            </form>
          </CardContent>

          <Separator className="my-1" />

          <CardFooter className="pt-3 pb-4 flex items-center justify-between text-xs text-slate-500">
            <span className="text-[11px]">Demo: <code className="font-mono font-bold text-slate-700">owner / owner123</code></span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setUsername("owner")
                setPassword("owner123")
                setError(null)
              }}
              className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 font-semibold cursor-pointer h-7 text-xs px-2"
            >
              Auto Fill
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Clean Subtle Footer */}
      <footer className="text-center text-xs text-slate-400 relative z-10">
        &copy; {new Date().getFullYear()} Rajib Enterprise. All rights reserved.
      </footer>
    </div>
  )
}
