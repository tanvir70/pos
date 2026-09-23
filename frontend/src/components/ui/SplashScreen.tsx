import { useState, useEffect } from "react"
import { Sprout, RotateCw } from "lucide-react"

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
      className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative select-none"
    >
      {/* Subtle brand tint */}
      <div
        className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-emerald-100/40 via-slate-50/40 to-transparent pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col items-center max-w-sm text-center">
        {/* Dealership Brand Icon */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white flex items-center justify-center shadow-lg shadow-emerald-700/20 ring-1 ring-emerald-500/20 mb-4 animate-pulse">
          <Sprout className="w-7 h-7" />
        </div>

        {/* Brand Names */}
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Rajib Enterprise
        </h1>
        <p className="text-xs text-slate-500 mt-1 font-medium">
          মেসার্স রাজীব এন্টারপ্রাইজ • Agrochemical Cockpit
        </p>

        {/* Loading Spinner & Active Status */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white border border-slate-200/80 shadow-xs text-xs font-semibold text-slate-700">
            <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin shrink-0" />
            <span>{message}</span>
          </div>

          {/* Delayed Notice when server/network takes >4 seconds */}
          {isSlow && (
            <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs text-center flex flex-col items-center gap-2.5 shadow-xs max-w-xs transition-opacity duration-300">
              <p className="font-medium leading-relaxed">
                Loading is taking longer than expected. Please check your network or ensure the server is running.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-950 bg-amber-200/80 hover:bg-amber-200 rounded-lg transition-colors cursor-pointer"
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
