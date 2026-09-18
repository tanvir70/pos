import { useEffect, useState } from "react"
import Sidebar from "./components/Sidebar"
import TopBar from "./components/TopBar"
import LoginPage from "./pages/LoginPage"
import PosCounter from "./pages/PosCounter"
import Dashboard from "./pages/Dashboard"
import Inventory from "./pages/Inventory"
import Customers from "./pages/Customers"
import Returns from "./pages/Returns"
import type { NavigationTab } from "./types"
import { ToastProvider } from "./context/ToastContext"
import { AuthProvider, useAuth } from "./context/AuthContext"
import { CartProvider } from "./context/CartContext"

const SIDEBAR_OPEN_KEY = "pos_sidebar_open"

function AppShell() {
  const [tab, setTab] = useState<NavigationTab>("pos")
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_OPEN_KEY)
      if (stored !== null) return stored === "true"
    } catch {
      // ignore storage failures, fall through to viewport-based default
    }
    // No saved preference yet: default open on desktop (like Claude's own
    // sidebar), closed on mobile where it would otherwise cover the screen.
    return typeof window === "undefined" || window.innerWidth >= 768
  })
  const { isOwner, isAuthenticated, isLoading, openPinModal } = useAuth()

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_OPEN_KEY, String(isSidebarOpen))
    } catch {
      // ignore storage failures
    }
  }, [isSidebarOpen])

  if (isLoading) {
    return <div className="min-h-screen bg-slate-50" />
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  return (
    <div className="h-screen flex bg-slate-50 overflow-hidden">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeTab={tab}
        onTabChange={setTab}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((v) => !v)}
          activeTab={tab}
        />

        {/* Main Content Shell */}
        <main
          className={`flex-1 min-h-0 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 ${
            tab === "pos" ? "overflow-hidden" : "overflow-y-auto"
          }`}
        >
          {tab === "pos" && <PosCounter isOwner={isOwner} />}
          {tab === "dashboard" && (
            <Dashboard
              isOwner={isOwner}
              onOpenPinModal={openPinModal}
              onNavigate={setTab}
            />
          )}
          {tab === "inventory" && <Inventory isOwner={isOwner} />}
          {tab === "customers" && <Customers isOwner={isOwner} />}
          {tab === "returns" && <Returns isOwner={isOwner} />}
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
