import type { HTMLAttributes, ReactNode } from "react"

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  className?: string
}

export function Card({ children, className = "", ...props }: CardProps) {
  return (
    <div
      className={`bg-white border border-frost-border rounded-2xl shadow-xs overflow-hidden ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  )
}

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
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
  if (children) {
    return (
      <div
        className={`px-5 py-3.5 border-b border-frost-border/60 bg-frost-surface/40 flex items-center justify-between ${className}`.trim()}
        {...props}
      >
        {children}
      </div>
    )
  }

  return (
    <div
      className={`px-5 py-3.5 border-b border-frost-border/60 bg-frost-surface/40 flex items-center justify-between gap-3 ${className}`.trim()}
      {...props}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && <span className="text-lg shrink-0">{icon}</span>}
        <div className="min-w-0">
          {title && (
            <h3 className="font-bold text-sm text-frost-dark bn-text leading-tight truncate">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-xs text-frost-muted bn-text leading-tight mt-0.5 truncate">
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
      className={`px-5 py-3.5 border-t border-frost-border/60 bg-frost-surface/30 flex items-center justify-between gap-3 ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  )
}
