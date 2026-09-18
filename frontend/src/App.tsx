import { useState } from "react"
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

function AppShell() {
  const [tab, setTab] = useState<NavigationTab>("pos")
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { isOwner, isAuthenticated, isLoading, openPinModal } = useAuth()

  if (isLoading) {
    return <div className="min-h-screen bg-slate-50" />
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      <TopBar onOpenMenu={() => setIsMenuOpen(true)} activeTab={tab} />
      <Sidebar
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        activeTab={tab}
        onTabChange={setTab}
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
