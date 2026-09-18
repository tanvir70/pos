import type { ReactNode } from "react"

export type BadgeVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "purple"
  | "neutral"

export interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  size?: "sm" | "md"
  dot?: boolean
  className?: string
}

const variantStyles: Record<BadgeVariant, { container: string; dot: string }> = {
  success: {
    container: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-600",
  },
  warning: {
    container: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-600",
  },
  danger: {
    container: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-600 animate-pulse",
  },
  info: {
    container: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-600",
  },
  purple: {
    container: "bg-purple-50 text-purple-700 border-purple-200",
    dot: "bg-purple-600",
  },
  neutral: {
    container: "bg-slate-50 text-slate-700 border-slate-200",
    dot: "bg-slate-500",
  },
}

export function Badge({
  children,
  variant = "neutral",
  size = "md",
  dot = false,
  className = "",
}: BadgeProps) {
  const styles = variantStyles[variant]
  const sizeClasses =
    size === "sm"
      ? "text-[10px] px-1.5 py-0.5 rounded-md"
      : "text-xs px-2 py-0.5 rounded-md"

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold border tabular-nums select-none whitespace-nowrap ${styles.container} ${sizeClasses} ${className}`.trim()}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${styles.dot}`} />}
      <span className="leading-none">{children}</span>
    </span>
  )
}

export default Badge
