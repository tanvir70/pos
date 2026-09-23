import * as React from "react"
import { cn } from "@/lib/utils"

export interface CardProps extends React.ComponentProps<"div"> {
  size?: "default" | "sm"
}

export function Card({ className, size = "default", ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card flex flex-col overflow-hidden rounded-xl border border-border bg-card text-sm text-card-foreground shadow-xs",
        className,
      )}
      {...props}
    />
  )
}

export interface CardHeaderProps extends Omit<React.ComponentProps<"div">, "title"> {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  action?: React.ReactNode
  icon?: React.ReactNode
}

export function CardHeader({
  className,
  title,
  subtitle,
  action,
  icon,
  children,
  ...props
}: CardHeaderProps) {
  if (children) {
    return (
      <div
        data-slot="card-header"
        className={cn(
          "flex flex-col gap-1.5 p-5 border-b border-border bg-slate-50/50",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    )
  }

  return (
    <div
      data-slot="card-header"
      className={cn(
        "flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border bg-slate-50/60",
        className,
      )}
      {...props}
    >
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

export function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("text-base font-semibold text-slate-900 leading-snug", className)}
      {...props}
    />
  )
}

export function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-xs text-slate-500", className)}
      {...props}
    />
  )
}

export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("p-5", className)}
      {...props}
    />
  )
}

// Backward-compatible alias for legacy calls
export const CardBody = CardContent

export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center justify-between gap-3 border-t border-border bg-slate-50/40 px-5 py-3.5",
        className,
      )}
      {...props}
    />
  )
}

export default Card
