import * as React from "react"
import { Search, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface TableProps extends React.ComponentProps<"table"> {
  containerClassName?: string
}

function Table({ className, containerClassName, ...props }: TableProps) {
  return (
    <div
      data-slot="table-container"
      className={cn(
        "relative w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs",
        containerClassName
      )}
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-xs", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold select-none [&_tr]:border-b",
        className
      )}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("divide-y divide-slate-200/50 [&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

export interface TableRowProps extends React.ComponentProps<"tr"> {
  isHoverable?: boolean
  isSelected?: boolean
}

function TableRow({
  className,
  isHoverable = true,
  isSelected = false,
  ...props
}: TableRowProps) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors data-[state=selected]:bg-muted",
        isHoverable && "hover:bg-slate-50/60",
        isSelected && "bg-emerald-50/60",
        className
      )}
      {...props}
    />
  )
}

export interface TableHeadProps extends React.ComponentProps<"th"> {
  align?: "left" | "center" | "right"
}

function TableHead({
  className,
  align = "left",
  ...props
}: TableHeadProps) {
  const alignClass = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  }[align]

  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-3.5 py-3 text-xs font-bold text-slate-900 whitespace-nowrap align-middle text-foreground [&:has([role=checkbox])]:pr-0",
        alignClass,
        className
      )}
      {...props}
    />
  )
}

export interface TableCellProps extends React.ComponentProps<"td"> {
  align?: "left" | "center" | "right"
  isMonospace?: boolean
}

function TableCell({
  className,
  align = "left",
  isMonospace = false,
  ...props
}: TableCellProps) {
  const alignClass = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  }[align]

  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-3.5 py-3 text-xs text-slate-900 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        alignClass,
        isMonospace && "font-mono tabular-nums font-semibold",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

// Backward-compatible alias
export const TableHeaderCell = TableHead

export interface TableEmptyStateProps {
  colSpan: number
  icon?: React.ReactNode
  message?: string
  submessage?: string
  title?: string
  description?: string
  action?: React.ReactNode
}

export function TableEmptyState({
  colSpan,
  icon = <Search className="w-7 h-7 mx-auto" />,
  message,
  submessage,
  title,
  description,
  action,
}: TableEmptyStateProps) {
  const displayTitle = title || message || "No data found"
  const displaySubtitle = description !== undefined ? description : (submessage || "Try adjusting your search filters and try again")

  return (
    <tr>
      <td colSpan={colSpan} className="py-12 text-center text-slate-500">
        <span className="inline-block text-slate-400">{icon}</span>
        <p className="mt-2 text-sm font-bold text-slate-900">{displayTitle}</p>
        {displaySubtitle && (
          <p className="text-xs text-slate-500 mt-0.5">{displaySubtitle}</p>
        )}
        {action && <div className="mt-4 flex justify-center">{action}</div>}
      </td>
    </tr>
  )
}

export function TableLoadingState({
  colSpan,
  text = "Loading data...",
}: {
  colSpan: number
  text?: string
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-12 text-center text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin inline-block text-emerald-600" />
        <p className="mt-2 text-xs font-semibold text-slate-500">{text}</p>
      </td>
    </tr>
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}

export default Table
