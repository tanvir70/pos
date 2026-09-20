import { useEffect, useState, useCallback } from "react"
import Sidebar from "./components/Sidebar"
import TopBar from "./components/TopBar"
import LoginPage from "./pages/LoginPage"
import PosCounter from "./pages/PosCounter"
import Dashboard from "./pages/Dashboard"
import Inventory from "./pages/Inventory"
import Customers from "./pages/Customers"
import Returns from "./pages/Returns"
import Settings from "./pages/Settings"
import StockLedgerPage from "./pages/StockLedgerPage"
import type { NavigationTab } from "./types"
import { ToastProvider } from "./context/ToastContext"
import { AuthProvider, useAuth } from "./context/AuthContext"
import { CartProvider } from "./context/CartContext"
import { isTypingTarget } from "./utils/keyboard"

const SIDEBAR_OPEN_KEY = "pos_sidebar_open"

function AppShell() {
  const [tab, setTab] = useState<NavigationTab>("pos")
  const [ledgerFilter, setLedgerFilter] = useState<{ productId?: number; lotId?: number } | undefined>(undefined)

  const handleNavigate = useCallback(
    (newTab: NavigationTab, params?: { productId?: number; lotId?: number }) => {
      if (newTab === "bin-card") {
        setLedgerFilter(params)
      } else {
        setLedgerFilter(undefined)
      }
      setTab(newTab)
    },
    []
  )

  const [isFocusMode, setIsFocusMode] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_OPEN_KEY)
      return stored === null ? true : stored === "true"
    } catch {
      return true
    }
  })
  const { isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_OPEN_KEY, String(isSidebarOpen))
    } catch {
      // ignore storage failures
    }
  }, [isSidebarOpen])

  // Full Page Focus mode: hide the sidebar and header so the counter fills the screen.
  // It only applies to the POS tab, so leaving that tab drops out of it.
  useEffect(() => {
    if (tab !== "pos") {
      setIsFocusMode(false)
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {})
      }
    }
  }, [tab])

  const toggleFocusMode = useCallback(() => {
    setIsFocusMode((prev) => {
      const next = !prev
      if (next) {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {})
        }
      } else {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {})
        }
      }
      return next
    })
  }, [])

  // Sync native fullscreen exits (e.g. user presses Esc) back to focus mode state
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isFocusMode) {
        setIsFocusMode(false)
      }
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange)
  }, [isFocusMode])

  useEffect(() => {
    if (tab !== "pos") return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "F8" || isTypingTarget(e.target)) return
      e.preventDefault()
      toggleFocusMode()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [tab, toggleFocusMode])

  if (isLoading) {
    return <div className="min-h-screen bg-slate-50" />
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  return (
    <div className="h-screen flex bg-slate-50 overflow-hidden">
      {!isFocusMode && (
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          activeTab={tab}
          onTabChange={(t) => handleNavigate(t)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!isFocusMode && (
          <TopBar
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={() => setIsSidebarOpen((v) => !v)}
            activeTab={tab}
          />
        )}

        {/* Main Content Shell */}
        <main
          className={`flex-1 min-h-0 w-full ${
            isFocusMode ? "p-2 sm:p-2.5" : "px-3 sm:px-6 py-4"
          } ${
            tab === "pos" ? "overflow-hidden" : "overflow-y-auto"
          }`}
        >
          {tab === "pos" && (
            <PosCounter
              isFocusMode={isFocusMode}
              onToggleFocusMode={toggleFocusMode}
            />
          )}
          {tab === "dashboard" && (
            <Dashboard
              onNavigate={handleNavigate}
            />
          )}
          {tab === "inventory" && <Inventory onNavigate={handleNavigate} />}
          {tab === "bin-card" && (
            <StockLedgerPage
              initialProductId={ledgerFilter?.productId}
              initialLotId={ledgerFilter?.lotId}
            />
          )}
          {tab === "customers" && <Customers />}
          {tab === "returns" && <Returns />}
          {tab === "settings" && <Settings />}
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <CartProvider>
          <AppShell />
        </CartProvider>
      </AuthProvider>
    </ToastProvider>
  )
}
