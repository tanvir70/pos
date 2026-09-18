import type {
  HTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
  ReactNode,
} from "react"
import { Search, Loader2 } from "lucide-react"

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  children: ReactNode
  className?: string
  containerClassName?: string
}

export function Table({
  children,
  className = "",
  containerClassName = "",
  ...props
}: TableProps) {
  return (
    <div
      className={`overflow-x-auto w-full rounded-xl border border-slate-200 bg-white shadow-xs ${containerClassName}`.trim()}
    >
      <table className={`w-full text-left text-xs ${className}`.trim()} {...props}>
        {children}
      </table>
    </div>
  )
}

export function TableHead({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={`bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold select-none ${className}`.trim()}
      {...props}
    >
      {children}
    </thead>
  )
}

export function TableBody({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={`divide-y divide-slate-200/50 ${className}`.trim()} {...props}>
      {children}
    </tbody>
  )
}

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  children: ReactNode
  isHoverable?: boolean
  isSelected?: boolean
  className?: string
}

export function TableRow({
  children,
  isHoverable = true,
  isSelected = false,
  className = "",
  ...props
}: TableRowProps) {
  const hoverClass = isHoverable ? "hover:bg-slate-50/60 transition-colors" : ""
  const selectedClass = isSelected ? "bg-emerald-50/60" : ""

  return (
    <tr className={`${hoverClass} ${selectedClass} ${className}`.trim()} {...props}>
      {children}
    </tr>
  )
}

export interface TableHeaderCellProps
  extends ThHTMLAttributes<HTMLTableCellElement> {
  children: ReactNode
  align?: "left" | "center" | "right"
  className?: string
}

export function TableHeaderCell({
  children,
  align = "left",
  className = "",
  ...props
}: TableHeaderCellProps) {
  const alignClass = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  }[align]

  return (
    <th
      className={`px-3.5 py-3 text-xs font-bold text-slate-900 ${alignClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </th>
  )
}

export interface TableCellProps
  extends TdHTMLAttributes<HTMLTableCellElement> {
  children: ReactNode
  align?: "left" | "center" | "right"
  isMonospace?: boolean
  className?: string
}

export function TableCell({
  children,
  align = "left",
  isMonospace = false,
  className = "",
  ...props
}: TableCellProps) {
  const alignClass = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  }[align]

  const fontClass = isMonospace ? "font-mono tabular-nums font-semibold" : ""

  return (
    <td
      className={`px-3.5 py-3 text-xs text-slate-900 align-middle ${alignClass} ${fontClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </td>
  )
}

export interface TableEmptyStateProps {
  colSpan: number
  icon?: ReactNode
  message?: string
  submessage?: string
  action?: ReactNode
}

export function TableEmptyState({
  colSpan,
  icon = <Search className="w-7 h-7 mx-auto" />,
  message = "No data found",
  submessage = "Try adjusting your search filters and try again",
  action,
}: TableEmptyStateProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-12 text-center text-slate-500">
        <span className="inline-block text-slate-400">{icon}</span>
        <p className="mt-2 text-sm font-bold text-slate-900">{message}</p>
        {submessage && (
          <p className="text-xs text-slate-500 mt-0.5">{submessage}</p>
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
        <Loader2 className="w-6 h-6 animate-spin inline-block" />
        <p className="mt-2 text-xs font-semibold text-slate-500">{text}</p>
      </td>
    </tr>
  )
}

export default Table

