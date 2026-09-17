import type {
  HTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
  ReactNode,
} from "react"

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
      className={`overflow-x-auto w-full rounded-xl border border-frost-border bg-white shadow-xs ${containerClassName}`.trim()}
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
      className={`bg-frost-surface/80 border-b border-frost-border text-frost-muted uppercase tracking-wider font-bold bn-text select-none ${className}`.trim()}
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
    <tbody className={`divide-y divide-frost-border/50 ${className}`.trim()} {...props}>
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
  const hoverClass = isHoverable ? "hover:bg-frost-surface/60 transition-colors" : ""
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
      className={`px-3.5 py-3 text-xs font-bold text-frost-dark ${alignClass} ${className}`.trim()}
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
      className={`px-3.5 py-3 text-xs text-frost-dark align-middle ${alignClass} ${fontClass} ${className}`.trim()}
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
  icon = "🔍",
  message = "কোনো তথ্য পাওয়া যায়নি",
  submessage = "অনুসন্ধান ফিল্টার পরিবর্তন করে পুনরায় চেষ্টা করুন",
  action,
}: TableEmptyStateProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-12 text-center text-frost-muted">
        <span className="text-3xl inline-block">{icon}</span>
        <p className="mt-2 text-sm font-bold text-frost-dark bn-text">{message}</p>
        {submessage && (
          <p className="text-xs text-frost-muted mt-0.5 bn-text">{submessage}</p>
        )}
        {action && <div className="mt-4 flex justify-center">{action}</div>}
      </td>
    </tr>
  )
}

export function TableLoadingState({
  colSpan,
  text = "তথ্য লোড হচ্ছে...",
}: {
  colSpan: number
  text?: string
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-12 text-center text-frost-muted">
        <span className="text-2xl animate-spin inline-block">⏳</span>
        <p className="mt-2 text-xs font-semibold text-frost-muted bn-text">{text}</p>
      </td>
    </tr>
  )
}

export default Table

