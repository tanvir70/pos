import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

export const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden border font-semibold tabular-nums whitespace-nowrap transition-all select-none leading-none",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow-2xs",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive/10 text-destructive border-destructive/20",
        outline: "border-border text-foreground",
        // POS-specific status variants
        success: "border-emerald-200 bg-emerald-50 text-emerald-800",
        warning: "border-amber-200 bg-amber-50 text-amber-800",
        danger: "border-rose-200 bg-rose-50 text-rose-800",
        info: "border-blue-200 bg-blue-50 text-blue-800",
        purple: "border-purple-200 bg-purple-50 text-purple-800",
        emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
        neutral: "border-slate-200 bg-slate-50 text-slate-700",
      },
      size: {
        sm: "text-[10px] px-1.5 py-0.5 rounded-md",
        md: "text-xs px-2 py-0.5 rounded-md",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "md",
    },
  },
)

const dotStyles: Record<string, string> = {
  default: "bg-primary-foreground",
  success: "bg-emerald-600",
  warning: "bg-amber-600",
  danger: "bg-rose-600 animate-pulse",
  destructive: "bg-destructive",
  info: "bg-blue-600",
  purple: "bg-purple-600",
  emerald: "bg-emerald-600",
  neutral: "bg-slate-500",
}

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  asChild?: boolean
  dot?: boolean
}

export function Badge({
  className,
  variant = "neutral",
  size = "md",
  dot = false,
  asChild = false,
  children,
  ...props
}: BadgeProps) {
  const Comp = asChild ? Slot.Root : "span"
  const dotColor = dotStyles[variant || "neutral"] || "bg-current"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant, size, className }))}
      {...props}
    >
      {dot && <span className={cn("size-1.5 rounded-full shrink-0", dotColor)} />}
      <span>{children}</span>
    </Comp>
  )
}

export default Badge
