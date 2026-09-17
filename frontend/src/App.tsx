import { useState } from "react"
import Navbar from "./components/Navbar"
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
  const { isOwner, openPinModal } = useAuth()

  return (
    <div className="min-h-screen bg-frost-bg flex flex-col">
      <Navbar activeTab={tab} onTabChange={setTab} />

      {/* Main Content Shell */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4">
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
