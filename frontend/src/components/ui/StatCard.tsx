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
  isMasked?: boolean
  onUnlockClick?: () => void
  className?: string
}

const colorThemes = {
  emerald: {
    bg: "bg-emerald-50/70",
    border: "border-emerald-200",
    iconBg: "bg-emerald-100 text-emerald-800",
    text: "text-emerald-900",
  },
  blue: {
    bg: "bg-blue-50/70",
    border: "border-blue-200",
    iconBg: "bg-blue-100 text-blue-800",
    text: "text-blue-900",
  },
  amber: {
    bg: "bg-amber-50/70",
    border: "border-amber-200",
    iconBg: "bg-amber-100 text-amber-800",
    text: "text-amber-900",
  },
  red: {
    bg: "bg-red-50/70",
    border: "border-red-200",
    iconBg: "bg-red-100 text-red-800",
    text: "text-red-900",
  },
  purple: {
    bg: "bg-purple-50/70",
    border: "border-purple-200",
    iconBg: "bg-purple-100 text-purple-800",
    text: "text-purple-900",
  },
  neutral: {
    bg: "bg-white",
    border: "border-frost-border",
    iconBg: "bg-frost-surface text-frost-dark",
    text: "text-frost-dark",
  },
}

export function StatCard({
  title,
  value,
  icon,
  subtitle,
  trend,
  color = "neutral",
  isMasked = false,
  onUnlockClick,
  className = "",
}: StatCardProps) {
  const theme = colorThemes[color]

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 shadow-xs transition-shadow hover:shadow-md ${theme.bg} ${theme.border} ${className}`.trim()}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-frost-muted bn-text truncate uppercase tracking-wider">
            {title}
          </p>

          <div className="mt-2 flex items-baseline gap-2">
            {isMasked ? (
              <div
                onClick={onUnlockClick}
                className="group flex items-center gap-1.5 cursor-pointer py-1 select-none"
                title="পিন দিয়ে আনলক করুন"
              >
                <span className="font-mono text-xl sm:text-2xl font-black text-gray-400 blur-xs group-hover:blur-none transition-all">
                  ৳••,•••.••
                </span>
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 rounded-full bn-text">
                  🔒 আনলক
                </span>
              </div>
            ) : (
              <div
                className={`font-black text-xl sm:text-2xl tabular-nums leading-tight truncate ${theme.text}`}
              >
                {value}
              </div>
            )}
          </div>

          {(subtitle || trend) && (
            <div className="mt-1.5 flex items-center gap-2 text-xs bn-text flex-wrap">
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
              {subtitle && <span className="text-frost-muted">{subtitle}</span>}
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
