import React from "react"
import { ArrowUp, ArrowDown, Lock } from "lucide-react"

export type StatTheme = "orange" | "navy" | "emerald" | "rose"

export interface GotposStatCardProps {
  title: string
  value: string | number
  trendPercent?: number
  trendLabel?: string
  theme: StatTheme
  icon: React.ReactNode
  isMasked?: boolean
  onUnlockClick?: () => void
  currencyPrefix?: boolean
}

const themeStyles: Record<
  StatTheme,
  {
    frontBg: string
    backBg: string
    iconColor: string
  }
> = {
  orange: {
    frontBg: "bg-orange-500",
    backBg: "bg-orange-500",
    iconColor: "text-white",
  },
  navy: {
    frontBg: "bg-[#0f2439]",
    backBg: "bg-[#0f2439]",
    iconColor: "text-white",
  },
  emerald: {
    frontBg: "bg-emerald-500",
    backBg: "bg-emerald-500",
    iconColor: "text-white",
  },
  rose: {
    frontBg: "bg-rose-500",
    backBg: "bg-rose-500",
    iconColor: "text-white",
  },
}

export const GotposStatCard: React.FC<GotposStatCardProps> = ({
  title,
  value,
  trendPercent,
  trendLabel = "From Last Week",
  theme,
  icon,
  isMasked = false,
  onUnlockClick,
}) => {
  const t = themeStyles[theme]
  const isPositive = (trendPercent ?? 0) >= 0

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-500 truncate">{title}</p>

          <div className="my-1.5 flex items-center gap-2">
            {isMasked ? (
              <button
                type="button"
                onClick={onUnlockClick}
                className="group flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-800 border border-slate-200 hover:border-amber-300 rounded-lg text-sm font-semibold transition-all cursor-pointer"
                title="Click to enter Owner PIN"
              >
                <Lock className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600" />
                <span>Locked</span>
              </button>
            ) : (
              <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                {value}
              </h3>
            )}
          </div>
        </div>

        {/* Layered tilted icon badge matching reference image */}
        <div className="relative w-11 h-11 flex items-center justify-center shrink-0">
          <div
            className={`absolute inset-0 rounded-xl opacity-20 -rotate-12 scale-105 pointer-events-none transition-transform group-hover:rotate-0 ${t.backBg}`}
          />
          <div
            className={`relative w-10 h-10 rounded-xl flex items-center justify-center ${t.frontBg} ${t.iconColor} shadow-xs font-bold text-lg`}
          >
            {icon}
          </div>
        </div>
      </div>

      {/* Bottom Trend Indicator */}
      <div className="mt-2 flex items-center gap-1.5 text-xs sm:text-sm font-medium">
        {trendPercent !== undefined ? (
          <>
            <span
              className={`inline-flex items-center gap-0.5 font-bold ${
                isPositive ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {isPositive ? (
                <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
              ) : (
                <ArrowDown className="w-3.5 h-3.5 stroke-[2.5]" />
              )}
              <span>{Math.abs(trendPercent)}%</span>
            </span>
            <span className="text-slate-400 font-normal">{trendLabel}</span>
          </>
        ) : (
          <span className="text-slate-400 text-xs font-normal">Real-time update</span>
        )}
      </div>
    </div>
  )
}

export default GotposStatCard
