import { useState, useCallback } from "react"
import { Calendar, X, Filter } from "lucide-react"
import Button from "./Button"
import { cn } from "@/lib/utils"

export type DatePreset = "ALL" | "TODAY" | "7_DAYS" | "THIS_MONTH" | "CUSTOM"

export interface DateRange {
  startDate?: string // YYYY-MM-DD
  endDate?: string // YYYY-MM-DD
  preset: DatePreset
}

export interface DateRangeFilterProps {
  value?: DateRange
  onChange: (range: DateRange) => void
  className?: string
  compact?: boolean
  showCustomInputsInline?: boolean
}

// Format Date to YYYY-MM-DD in local time
function toLocalDateString(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function getDateRangeFromPreset(preset: DatePreset): { startDate?: string; endDate?: string } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = toLocalDateString(today)

  switch (preset) {
    case "TODAY":
      return { startDate: todayStr, endDate: todayStr }
    case "7_DAYS": {
      const past7 = new Date(today)
      past7.setDate(past7.getDate() - 6)
      return { startDate: toLocalDateString(past7), endDate: todayStr }
    }
    case "THIS_MONTH": {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
      return { startDate: toLocalDateString(firstDay), endDate: todayStr }
    }
    case "ALL":
    default:
      return { startDate: undefined, endDate: undefined }
  }
}

export const defaultDateRange: DateRange = { preset: "ALL" }

export function DateRangeFilter({
  value = { preset: "ALL" },
  onChange,
  className,
  compact = false,
}: DateRangeFilterProps) {
  const [customStart, setCustomStart] = useState<string>(value.startDate || "")
  const [customEnd, setCustomEnd] = useState<string>(value.endDate || "")

  const handlePresetSelect = useCallback(
    (preset: DatePreset) => {
      if (preset === "CUSTOM") {
        const todayStr = toLocalDateString(new Date())
        const start = customStart || todayStr
        const end = customEnd || todayStr
        setCustomStart(start)
        setCustomEnd(end)
        onChange({ preset: "CUSTOM", startDate: start, endDate: end })
        return
      }

      const { startDate, endDate } = getDateRangeFromPreset(preset)
      onChange({ preset, startDate, endDate })
    },
    [customStart, customEnd, onChange]
  )

  const handleCustomApply = useCallback(() => {
    if (customStart && customEnd) {
      onChange({ preset: "CUSTOM", startDate: customStart, endDate: customEnd })
    }
  }, [customStart, customEnd, onChange])

  const handleClear = useCallback(() => {
    setCustomStart("")
    setCustomEnd("")
    onChange({ preset: "ALL", startDate: undefined, endDate: undefined })
  }, [onChange])

  const isFiltered = value.preset !== "ALL"

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {/* Preset Pills */}
      <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100/90 border border-slate-200 dark:bg-slate-800/80 dark:border-slate-700">
        <button
          type="button"
          onClick={() => handlePresetSelect("ALL")}
          className={cn(
            "px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer",
            value.preset === "ALL"
              ? "bg-white text-slate-900 shadow-2xs font-bold dark:bg-slate-900 dark:text-slate-100"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/50"
          )}
        >
          All Time
        </button>

        <button
          type="button"
          onClick={() => handlePresetSelect("TODAY")}
          className={cn(
            "px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer",
            value.preset === "TODAY"
              ? "bg-emerald-600 text-white shadow-xs font-bold"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/50"
          )}
        >
          Today
        </button>

        <button
          type="button"
          onClick={() => handlePresetSelect("7_DAYS")}
          className={cn(
            "px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer",
            value.preset === "7_DAYS"
              ? "bg-emerald-600 text-white shadow-xs font-bold"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/50"
          )}
        >
          7 Days
        </button>

        <button
          type="button"
          onClick={() => handlePresetSelect("THIS_MONTH")}
          className={cn(
            "px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer",
            value.preset === "THIS_MONTH"
              ? "bg-emerald-600 text-white shadow-xs font-bold"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/50"
          )}
        >
          This Month
        </button>

        <button
          type="button"
          onClick={() => handlePresetSelect("CUSTOM")}
          className={cn(
            "px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1",
            value.preset === "CUSTOM"
              ? "bg-emerald-600 text-white shadow-xs font-bold"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/50"
          )}
        >
          <Calendar className="w-3 h-3" />
          <span>Custom</span>
        </button>
      </div>

      {/* Expandable Custom Date Inputs */}
      {value.preset === "CUSTOM" && (
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-emerald-50/70 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 text-xs">
          <input
            type="date"
            value={customStart}
            onChange={(e) => {
              setCustomStart(e.target.value)
              if (e.target.value && customEnd) {
                onChange({ preset: "CUSTOM", startDate: e.target.value, endDate: customEnd })
              }
            }}
            className="h-7 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-[11px] text-slate-800 dark:text-slate-200 focus:border-emerald-600 focus:outline-hidden"
          />
          <span className="text-slate-400 font-bold">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => {
              setCustomEnd(e.target.value)
              if (customStart && e.target.value) {
                onChange({ preset: "CUSTOM", startDate: customStart, endDate: e.target.value })
              }
            }}
            className="h-7 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-[11px] text-slate-800 dark:text-slate-200 focus:border-emerald-600 focus:outline-hidden"
          />
        </div>
      )}

      {/* Clear Filter Button */}
      {isFiltered && (
        <button
          type="button"
          onClick={handleClear}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-800 dark:text-rose-300 dark:hover:text-rose-100 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/60 px-2 py-1 rounded-md transition-colors cursor-pointer"
          title="Reset date filter to All Time"
        >
          <X className="w-3 h-3" />
          <span>Clear Date</span>
        </button>
      )}
    </div>
  )
}

export default DateRangeFilter
