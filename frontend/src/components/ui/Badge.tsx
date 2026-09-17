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
    container: "bg-emerald-100 text-emerald-900 border-emerald-300",
    dot: "bg-emerald-600",
  },
  warning: {
    container: "bg-amber-100 text-amber-900 border-amber-300",
    dot: "bg-amber-600",
  },
  danger: {
    container: "bg-red-100 text-red-900 border-red-300",
    dot: "bg-red-600 animate-pulse",
  },
  info: {
    container: "bg-blue-100 text-blue-900 border-blue-300",
    dot: "bg-blue-600",
  },
  purple: {
    container: "bg-purple-100 text-purple-900 border-purple-300",
    dot: "bg-purple-600",
  },
  neutral: {
    container: "bg-frost-surface text-frost-dark border-frost-border",
    dot: "bg-frost-muted",
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
      ? "text-[10px] px-1.5 py-0.2 rounded-md"
      : "text-xs px-2.5 py-0.5 rounded-lg"

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold border tabular-nums select-none ${styles.container} ${sizeClasses} ${className}`.trim()}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${styles.dot}`} />}
      <span className="bn-text leading-none">{children}</span>
    </span>
  )
}

export default Badge

