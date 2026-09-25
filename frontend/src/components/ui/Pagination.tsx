import * as React from "react"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import Button from "./Button"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./select"

export interface PaginationProps {
  page: number // 0-indexed current page
  pageSize: number
  totalElements: number
  onPageChange: (newPage: number) => void
  onPageSizeChange?: (newPageSize: number) => void
  pageSizeOptions?: number[]
  itemLabel?: string
  className?: string
  disabled?: boolean
  showFirstLast?: boolean
}

export function Pagination({
  page,
  pageSize,
  totalElements,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 15, 25, 50],
  itemLabel = "items",
  className,
  disabled = false,
  showFirstLast = true,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalElements / pageSize))
  const startItem = totalElements === 0 ? 0 : page * pageSize + 1
  const endItem = Math.min((page + 1) * pageSize, totalElements)

  const isFirst = page === 0
  const isLast = page >= totalPages - 1 || totalElements === 0

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50/80 border-t border-slate-200 text-xs text-slate-600 select-none",
        className
      )}
    >
      {/* Showing X to Y of Z */}
      <div className="flex items-center gap-2">
        <span>
          Showing{" "}
          <span className="font-bold text-slate-900 tabular-nums">{startItem}</span> to{" "}
          <span className="font-bold text-slate-900 tabular-nums">{endItem}</span> of{" "}
          <span className="font-bold text-slate-900 tabular-nums">{totalElements}</span>{" "}
          {itemLabel}
        </span>

        {/* Page size dropdown */}
        {onPageSizeChange && pageSizeOptions && pageSizeOptions.length > 1 && (
          <div className="flex items-center gap-1.5 ml-2 border-l border-slate-200 pl-3">
            <span className="text-slate-500 text-[11px]">Rows:</span>
            <Select
              value={String(pageSize)}
              disabled={disabled}
              onValueChange={(val) => onPageSizeChange(Number(val))}
            >
              <SelectTrigger size="sm" className="h-7 w-[96px] bg-white border-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((opt) => (
                  <SelectItem key={opt} value={String(opt)}>
                    {opt} / page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center gap-1">
        {showFirstLast && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isFirst || disabled}
            onClick={() => onPageChange(0)}
            className="h-7 w-7 p-0 cursor-pointer"
            title="First page"
          >
            <ChevronsLeft className="w-3.5 h-3.5 text-slate-600" />
          </Button>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isFirst || disabled}
          onClick={() => onPageChange(Math.max(0, page - 1))}
          className="h-7 px-2.5 text-xs font-semibold cursor-pointer"
          leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
        >
          Prev
        </Button>

        <span className="px-2 text-slate-700 font-bold tabular-nums text-xs">
          Page {page + 1} of {totalPages}
        </span>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isLast || disabled}
          onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
          className="h-7 px-2.5 text-xs font-semibold cursor-pointer"
          rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
        >
          Next
        </Button>

        {showFirstLast && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLast || disabled}
            onClick={() => onPageChange(totalPages - 1)}
            className="h-7 w-7 p-0 cursor-pointer"
            title="Last page"
          >
            <ChevronsRight className="w-3.5 h-3.5 text-slate-600" />
          </Button>
        )}
      </div>
    </div>
  )
}

export default Pagination
