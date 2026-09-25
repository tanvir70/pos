/**
 * Keyboard helpers for the global POS hotkeys and accessible arrow-key navigation.
 */

/**
 * True when a key event came from a text entry field, where global hotkeys
 * (Enter to advance checkout, F-keys, slash shortcut) must not hijack keystrokes.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || typeof el.tagName !== "string") return false
  const tag = el.tagName.toUpperCase()
  return (
    tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable
  )
}

/**
 * Finds and focuses the primary search input on the currently active view.
 */
export function focusPrimarySearch(): boolean {
  const searchInput = document.querySelector<HTMLInputElement>('[data-primary-search="true"]')
  if (searchInput && typeof searchInput.focus === "function") {
    searchInput.focus()
    if (typeof searchInput.select === "function") {
      searchInput.select()
    }
    return true
  }
  return false
}

/**
 * Finds and focuses the active sidebar navigation menu button, or falls back to the first one.
 */
export function focusSidebarMenu(tabId?: string): boolean {
  let targetBtn: HTMLElement | null = null
  if (tabId) {
    targetBtn = document.querySelector<HTMLElement>(`[data-sidebar-tab="true"][data-tab-id="${tabId}"]`)
  }
  if (!targetBtn) {
    targetBtn = document.querySelector<HTMLElement>('[data-sidebar-tab="true"][data-active="true"]')
  }
  if (!targetBtn) {
    targetBtn = document.querySelector<HTMLElement>('[data-sidebar-tab="true"]')
  }
  if (targetBtn && typeof targetBtn.focus === "function") {
    targetBtn.focus()
    return true
  }
  return false
}

/**
 * Focuses the first table row in the active view, if present.
 */
export function focusFirstTableRow(): boolean {
  const firstRow = document.querySelector<HTMLElement>('[data-nav-row="true"]')
  if (firstRow && typeof firstRow.focus === "function") {
    firstRow.focus()
    return true
  }
  return false
}
