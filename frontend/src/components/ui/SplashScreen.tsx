import { useState, useEffect } from "react"
import { Sprout, RotateCw } from "lucide-react"
import { STORE_INFO } from "../../constants/store"
import BrandLogo from "./BrandLogo"

export interface SplashScreenProps {
  message?: string
}

export default function SplashScreen({
  message = "Starting POS cockpit...",
}: SplashScreenProps) {
  const [isSlow, setIsSlow] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSlow(true)
    }, 4000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 relative select-none"
    >
      {/* Subtle brand tint */}
      <div
        className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-emerald-100/40 via-slate-50/40 to-transparent dark:from-emerald-950/20 dark:via-slate-950/40 pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col items-center max-w-sm text-center">
        {/* Dealership Brand Icon */}
        <BrandLogo size="xl" variant="image" className="mb-4 animate-pulse" />

        {/* Brand Names */}
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          {STORE_INFO.name}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
          মেসার্স রাজীব এন্টারপ্রাইজ • Agrochemical Cockpit
        </p>

        {/* Loading Spinner & Active Status */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs text-xs font-semibold text-slate-700 dark:text-slate-300">
            <div className="w-4 h-4 border-2 border-emerald-600 dark:border-emerald-500 border-t-transparent rounded-full animate-spin shrink-0" />
            <span>{message}</span>
          </div>

          {/* Delayed Notice when server/network takes >4 seconds */}
          {isSlow && (
            <div className="mt-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs text-center flex flex-col items-center gap-2.5 shadow-xs max-w-xs transition-opacity duration-300">
              <p className="font-medium leading-relaxed">
                Loading is taking longer than expected. Please check your network or ensure the server is running.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-950 dark:text-amber-200 bg-amber-200/80 dark:bg-amber-900/60 hover:bg-amber-200 dark:hover:bg-amber-800 rounded-lg transition-colors cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Reload Page</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
