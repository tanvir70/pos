import type { ReactNode } from "react"

export interface CollapseProps {
  show: boolean
  children: ReactNode
  className?: string
}

/**
 * Animates a block smoothly in/out of layout (height 0 -> auto -> 0) using the
 * CSS grid-template-rows collapse technique, so conditionally rendered content
 * doesn't cause the surrounding layout to jump instantly.
 */
export function Collapse({ show, children, className = "" }: CollapseProps) {
  return (
    <div
      className={`grid transition-[grid-template-rows] duration-200 ease-out ${
        show ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
      }`}
    >
      <div className={`overflow-hidden min-h-0 ${className}`}>{children}</div>
    </div>
  )
}

export default Collapse
