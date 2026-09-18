import type { HTMLAttributes, ReactNode } from "react"

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  className?: string
}

export function Card({ children, className = "", ...props }: CardProps) {
  return (
    <div
      className={`bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  )
}

export interface CardHeaderProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  icon?: ReactNode
  className?: string
  children?: ReactNode
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
  className = "",
  children,
  ...props
}: CardHeaderProps) {
  const headerClass =
    "px-5 py-3.5 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between"

  if (children) {
    return (
      <div className={`${headerClass} ${className}`.trim()} {...props}>
        {children}
      </div>
    )
  }

  return (
    <div className={`${headerClass} gap-3 ${className}`.trim()} {...props}>
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && <span className="text-slate-500 shrink-0 flex items-center">{icon}</span>}
        <div className="min-w-0">
          {title && (
            <h3 className="font-semibold text-sm text-slate-900 leading-tight truncate">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-xs text-slate-500 leading-tight mt-0.5 truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
    </div>
  )
}

export interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  className?: string
}

export function CardBody({ children, className = "", ...props }: CardBodyProps) {
  return (
    <div className={`p-5 ${className}`.trim()} {...props}>
      {children}
    </div>
  )
}

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  className?: string
}

export function CardFooter({ children, className = "", ...props }: CardFooterProps) {
  return (
    <div
      className={`px-5 py-3.5 border-t border-slate-200 bg-slate-50/40 flex items-center justify-between gap-3 ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  )
}

export default Card
