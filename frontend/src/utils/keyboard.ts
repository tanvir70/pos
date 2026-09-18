/**
 * Keyboard helpers for the global POS hotkeys.
 */

/**
 * True when a key event came from a text entry field, where global hotkeys
 * (Enter to advance checkout, F-keys) must not hijack the keystroke.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || typeof el.tagName !== "string") return false
  const tag = el.tagName.toUpperCase()
  return (
    tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable
  )
}
