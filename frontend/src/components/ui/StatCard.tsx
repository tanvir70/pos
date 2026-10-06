import type { ReactNode } from "react"

export interface StatCardProps {
  title: string
  value: ReactNode
  icon: ReactNode
  subtitle?: string
  trend?: {
    value: string
    isPositive?: boolean
  }
  color?: "emerald" | "blue" | "amber" | "red" | "purple" | "neutral"
  className?: string
}

const colorThemes = {
  emerald: {
    bg: "bg-emerald-50/70 dark:bg-emerald-950/40",
    border: "border-emerald-200 dark:border-emerald-800",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300",
    text: "text-emerald-900 dark:text-emerald-200",
  },
  blue: {
    bg: "bg-blue-50/70 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-800",
    iconBg: "bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300",
    text: "text-blue-900 dark:text-blue-200",
  },
  amber: {
    bg: "bg-amber-50/70 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-800",
    iconBg: "bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300",
    text: "text-amber-900 dark:text-amber-200",
  },
  red: {
    bg: "bg-red-50/70 dark:bg-red-950/40",
    border: "border-red-200 dark:border-red-800",
    iconBg: "bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-300",
    text: "text-red-900 dark:text-red-200",
  },
  purple: {
    bg: "bg-purple-50/70 dark:bg-purple-950/40",
    border: "border-purple-200 dark:border-purple-800",
    iconBg: "bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300",
    text: "text-purple-900 dark:text-purple-200",
  },
  neutral: {
    bg: "bg-white dark:bg-slate-900",
    border: "border-slate-200 dark:border-slate-800",
    iconBg: "bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100",
    text: "text-slate-900 dark:text-slate-100",
  },
}

export function StatCard({
  title,
  value,
  icon,
  subtitle,
  trend,
  color = "neutral",
  className = "",
}: StatCardProps) {
  const theme = colorThemes[color]

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 shadow-xs transition-shadow hover:shadow-md ${theme.bg} ${theme.border} ${className}`.trim()}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate uppercase tracking-wider">
            {title}
          </p>

          <div className="mt-2 flex items-baseline gap-2">
            <div
              className={`font-black text-xl sm:text-2xl tabular-nums leading-tight truncate ${theme.text}`}
            >
              {value}
            </div>
          </div>

          {(subtitle || trend) && (
            <div className="mt-1.5 flex items-center gap-2 text-xs flex-wrap">
              {trend && (
                <span
                  className={`font-bold tabular-nums px-1.5 py-0.2 rounded text-[10px] ${
                    trend.isPositive
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {trend.isPositive ? "▲" : "▼"} {trend.value}
                </span>
              )}
              {subtitle && <span className="text-slate-500 dark:text-slate-400">{subtitle}</span>}
            </div>
          )}
        </div>

        <div
          className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-xl sm:text-2xl shrink-0 shadow-xs ${theme.iconBg}`}
        >
          {icon}
        </div>
      </div>
    </div>
  )
}

export default StatCard
