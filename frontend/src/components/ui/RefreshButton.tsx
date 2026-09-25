import React from "react"
import { RefreshCw } from "lucide-react"

export interface RefreshButtonProps {
  onClick: () => void
  isLoading?: boolean
  title?: string
  className?: string
  size?: "sm" | "md"
}

export default function RefreshButton({
  onClick,
  isLoading = false,
  title = "Refresh data",
  className = "",
  size = "md",
}: RefreshButtonProps) {
  const sizeClasses = size === "sm" ? "h-8 w-8 rounded-lg" : "h-9 w-9 rounded-xl"
  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      title={title}
      aria-label={title}
      className={`inline-flex items-center justify-center border border-slate-200/90 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 hover:text-slate-900 transition-all cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed shrink-0 ${sizeClasses} ${className}`}
    >
      <RefreshCw className={`${iconSize} text-slate-700 transition-transform ${isLoading ? "animate-spin" : ""}`} />
    </button>
  )
}
