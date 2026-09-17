# Technical Design Specification: High-Performance POS & Warehouse Terminal

**Document:** `docs/superpowers/specs/2026-09-17-high-performance-frontend-terminal-design.md`  
**Date:** 2026-09-17  
**Status:** Approved  
**Target Environment:** Local Dealership Network / Web Application (Optimized for 1366×768 Counter Laptops up to 1080p Desktop Monitors)  
**Primary Tech Stack:** React 19 + TypeScript 5.7 + Vite 8 + Tailwind CSS v4 (Integrated with Spring Boot 3.3.3 Enterprise Hardened Backend)  

---

## 1. Executive Summary & Core Architectural Principles

This document specifies the complete frontend redesign and component overhaul for the **Al-Amin Traders (মেসার্স আল-আমিন ট্রেডার্স) Point of Sale & Warehouse Inventory System**, tailored specifically for Agrochemical Dealerships in Bangladesh.

### Core Architectural Principles:
1. **Zero-Lag Terminal Performance:** Instant hardware barcode wedge capture ($\le 30\text{ms}$ buffer), debounced text search ($150\text{ms}$), granular React component memoization (`React.memo`), and optimistic UI updates.
2. **High-Visibility Counter Ergonomics:** High-contrast dark slate / stark color palette, minimum $48\text{px}$ touch targets, glare resistance, and zero-vertical-scroll 60/40 split cockpit layout for standard $1366 \times 768$ store laptops.
3. **Rock-Solid Financial Precision:** Fixed-point integer/paisa rounding utility (`roundAccounting`) eliminating JavaScript floating-point rounding errors (`0.1 + 0.2`).
4. **Resilient State Persistence:** Active POS cart draft mirrored automatically in `sessionStorage` preventing accidental bill loss on tab switches or browser reloads.
5. **Strict Security & Role Escalation:** JWT authentication with zero-friction cashier auto-initialization (`ROLE_CASHIER`), 4-digit Owner PIN modal (`ROLE_OWNER`), 5-minute inactivity auto-lock, and sensitive financial masking.
6. **Regulatory Agrochemical Compliance:** Strict enforcement of the *Pesticide Ordinance 1971*—hard blocking expired batches, FEFO lot defaulting, and permanent isolation of damaged goods in `QUARANTINE`.
7. **Dual Printing Fidelity:** Pixel-perfect 80mm thermal receipt slip and full A4 Wholesale Legal Challan with dual signatures, plus precision zero-margin $50\text{mm} \times 25\text{mm}$ thermal barcode sticker output.

---

## 2. Directory Structure & Modular Component Architecture

```
frontend/src/
├── api/
│   ├── client.ts                 # Native fetch wrapper with JWT bearer injection, X-Idempotency-Key & 401 recovery
│   └── endpoints.ts              # Typed REST API endpoints matching Spring Boot controllers
│
├── context/
│   ├── AuthContext.tsx           # JWT token management, Role (CASHIER/OWNER), 4-digit PIN verification, auto-lock
│   ├── CartContext.tsx           # Active invoice cart, FEFO lot selector, split stock allocation, bargaining overrides
│   └── ToastContext.tsx          # High-visibility alert banners mapping backend ErrorResponse & RFC 7807 to Bangla
│
├── utils/
│   ├── currency.ts               # Fixed-point paisa rounding, BDT formatting (৳), and cash drawer math
│   ├── barcode.ts                # Hardware wedge buffer timing (<= 30ms burst detection)
│   └── whatsapp.ts               # Strict Bangladeshi phone normalization (wa.me/8801XXXXXXXXX)
│
├── components/
│   ├── ui/                       # Reusable High-Contrast Design System
│   │   ├── Button.tsx            # High-contrast touch buttons (Primary, Danger, Success, Ghost, Numpad)
│   │   ├── Input.tsx             # Form text/number inputs with scanner steal prevention
│   │   ├── Badge.tsx             # Status pills (Valid, Expiring Soon, Expired, Quarantined)
│   │   ├── Card.tsx              # Clean container surfaces with sharp borders
│   │   ├── Table.tsx             # Dense tabular grid with sorting & sticky header
│   │   ├── Modal.tsx             # Accessible dialog shell with focus trap & Esc key
│   │   ├── TouchNumpad.tsx       # Oversized touch calculator (0-9, Backspace, Clear, Quick Cash)
│   │   ├── StatCard.tsx          # KPI cards with owner-mode blur masking
│   │   └── Pagination.tsx        # Server-side pagination controls
│   │
│   ├── layout/
│   │   ├── Sidebar.tsx           # Persistent left navigation rail (7 major tabs + backup)
│   │   ├── Header.tsx            # Store branding, cash in drawer pill, active role badge & lock/unlock
│   │   └── ConnectionBanner.tsx  # Network online/offline indicator
│   │
│   ├── pos/
│   │   ├── ProductCatalogGrid.tsx# 60% Left Section: Quick categories & tap-to-add product cards
│   │   ├── CartTicket.tsx        # 40% Right Section: Line items, FEFO lot dropdown, price override
│   │   ├── SettlementPanel.tsx   # Oversized cash tendered, quick cash chips, change display & checkout
│   │   └── DualPrintModal.tsx    # Post-checkout 80mm thermal slip vs A4 Wholesale Challan preview
│   │
│   ├── inventory/
│   │   ├── LotEntryModal.tsx       # (Cartons * Multiplier) + Loose Units intake calculator
│   │   ├── BarcodeStickerModal.tsx # Precision 50x25mm thermal sticker generator
│   │   └── ProductEntryModal.tsx   # New product catalog addition
│   │
│   ├── quarantine/
│   │   └── QuarantineDisposeModal.tsx # Supervisor write-off disposal with audit reason
│   │
│   └── customers/
│       ├── CustomerFormModal.tsx # Sub-dealer / retail farmer profile creation
│       └── RepaymentModal.tsx    # Cash credit collection with Money Receipt (MR No.)
│
├── pages/
│   ├── PosTerminalPage.tsx       # Main 60/40 counter billing cockpit
│   ├── InventoryPage.tsx         # Master product catalog & store stock matrix
│   ├── QuarantinePage.tsx        # Damaged chemical inventory tracking & write-offs
│   ├── CustomersPage.tsx         # Customer Khata, credit limits & WhatsApp due notices
│   ├── ReturnsPage.tsx           # Direct receipt-less returns & quarantine routing
│   └── DashboardPage.tsx         # Live cash in drawer, owner profit, and actionable FEFO alerts
│
├── types/
│   └── index.ts                  # Complete TypeScript domain contracts matching backend DTOs
├── App.tsx                       # Root container, context providers & tab router
└── main.tsx                      # Entry point & Tailwind v4 style imports
```

---

## 3. High-Performance State & Security Architecture

### 3.1 Authentication & Auto-Session Pipeline (`AuthContext.tsx`)
1. **App Boot:** If no valid token exists in `localStorage`, the frontend immediately fires `POST /api/auth/cashier-session`, receiving a standard cashier JWT with `ROLE_CASHIER` in $\le 50\text{ms}$. Cashiers are **never** blocked by a login wall.
2. **Owner Escalation:** Entering the 4-digit Owner PIN (`1234`) triggers `POST /api/auth/verify-pin`, escalating the session to `ROLE_OWNER` and revealing acquisition costs and profit margins.
3. **Inactivity Guard:** A 5-minute inactivity watchdog (tracking `mousemove`, `keydown`, `touchstart`) automatically clears the owner token and drops the terminal back to `ROLE_CASHIER`.
4. **Header Lock Button:** A prominent `[ 👑 মালিক মোড (লক করুন) ]` button in the header enables instant manual lock before stepping away from the counter.

### 3.2 Idempotency & Network Interceptor (`api/client.ts`)
- **Bearer Token Injection:** Injects `Authorization: Bearer <token>` into all outbound requests.
- **Idempotency Protection:** Generates a unique UUID v4 header `X-Idempotency-Key` for all state-mutating requests (`POST /api/sales`, `POST /api/returns`, `POST /api/customers/*/payments`). Accidental double-clicks on touch monitors return the cached original response without creating duplicate invoices.
- **401 Auto-Recovery:** If a token expires mid-session, the client transparently attempts a cashier re-authentication handshake and replays the request before throwing an error.

### 3.3 Hardware Barcode Scanner Buffer (`utils/barcode.ts`)
- Handheld 1D barcode scanners (USB/Bluetooth) emulate keyboard typing at ultra-high speed ($< 30\text{ms}$ between key events).
- A global `window` keydown interceptor collects keystrokes into a rolling buffer.
- If a sequence terminates with `Enter` and inter-keystroke timing is $\le 30\text{ms}$, the event is flagged as a **hardware barcode scan**:
  - `event.preventDefault()` and `event.stopPropagation()` prevent text leakage into whichever input field currently has focus.
  - The barcode is immediately matched against available product lots and added/incremented in the cart ticket.

### 3.4 Financial Precision Utility (`utils/currency.ts`)
- Prevents binary floating-point representation anomalies (`0.1 + 0.2 = 0.30000000000000004`).
- All calculations (Subtotal, Discount, Round-off, Cash Tendered, Change, Due) are executed in fixed-point integer cents/paisa:
  $$\text{paisa} = \text{Math.round}(\text{amount} \times 100)$$
- Formatted output is rendered with strict 2-decimal precision and Bengali currency symbol (`৳`).

---

## 4. POS Terminal Cockpit & Billing Specification (`PosTerminalPage.tsx`)

### 4.1 Layout Dimensions & Viewport Optimization
- Engineered specifically to eliminate vertical scrolling on $1366 \times 768$ laptops.
- Fixed 60% Left / 40% Right horizontal split.
- **Left Panel:** Sticky top category filter pills + search bar, followed by a compact, high-density grid of Product Cards with stock pills (`মজুদ: X`) and prices.
- **Right Panel (Cart Ticket):**
  - Customer selection header (Walk-in vs Wholesale dealer with current due display).
  - Dense line-item rows showing: Product Name, Base Unit Qty, FEFO Lot Dropdown (with expiry alerts), In-Line Bargaining Price input, Stock availability indicator (with deficit alert if selling into deficit), and Line Total.
  - Sticky bottom settlement card with Subtotal, 1-Click Round-Off button, Net Payable, Tendered Cash input with Quick-Cash chips (`Exact`, `+500`, `+1000`), Change Due, and oversized emerald Checkout button.

### 4.2 Counter Invariants & Edge Cases
1. **Scanner Hijack Guard:** Rapid scanner bursts automatically strip characters from active price inputs and route to the barcode cart lookup.
2. **Session Cart Draft:** Active cart is mirrored in `sessionStorage` (`pos_active_cart_v1`). Tab switching or refreshing restores the ticket with 100% fidelity.
3. **Pesticide Ordinance 1971 Enforcement:** Lots where `expiryDate < today` are hard-blocked with a prominent red badge (`মেয়াদোত্তীর্ণ - বিক্রয় নিষিদ্ধ`) and disabled from selection.
4. **Negative Stock Policy:** Store stock is allowed to enter negative balance with an amber indicator (`অনথিভুক্ত চালান / ঘাটতি`), allowing checkout during peak arrival rush before paper challan entry.
5. **Supervisor Cost Alert:** If a bargaining price is entered below the lot's purchase cost, an amber warning badge appears; in Cashier Mode, checkout requires Owner PIN confirmation.

### 4.3 POS Keyboard Hotkeys
- `F2`: Focus Barcode / Search Box
- `F4`: Toggle Retail / Wholesale Sale Mode
- `F8`: Focus Customer Search Dropdown
- `F9`: 1-Click Round-Off
- `NumPad Enter`: Complete Sale & Trigger Print Modal
- `Esc`: Close any open dialog or clear active search

---

## 5. Subsystem Detailed Specifications

### 5.1 Store Lot Intake & Shipment Receiving (`LotEntryModal.tsx`)
- **Intake Receiving Formula:**
  $$\text{Total Base Units} = (\text{Cartons Received} \times \text{Product Carton Multiplier}) + \text{Loose Base Units}$$
  Real-time breakdown preview prevents dockside arithmetic errors.
- **Store Entry:** All incoming shipments enter active store inventory (`DOKAN`) directly; backend auto-synthesizes Code 128 barcodes if left blank.

### 5.2 Thermal Barcode Sticker Studio (`BarcodeStickerModal.tsx`)
- Dedicated print layout configured with exact CSS:
  ```css
  @page {
    size: 50mm 25mm;
    margin: 0mm;
  }
  @media print {
    body { margin: 0; padding: 0; }
    .barcode-sticker {
      width: 50mm;
      height: 25mm;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
  }
  ```
- Renders crisp dealership branding, Bengali product name, lot number, expiry date, high-density Code 128 barcode, and retail MRP.

### 5.3 Quarantine & Damaged Stock Subsystem (`QuarantinePage.tsx`)
- Displays all damaged chemicals returned from retail sales or warehouse handling.
- Segregated permanently from sellable store stock.
- **Supervisor Write-Off Action:** `POST /api/inventory/quarantine/dispose` executed with Owner PIN verification, tracking disposal reason (*লিক হওয়া বোতল ধ্বংস*, *কোম্পানি রিটার্ন*) and write-off valuation.

### 5.4 Customer Khata & Debt Recovery (`CustomersPage.tsx`)
- Complete profiles: Dealer Name, Business Name, Father's Name (for rural union identification), Phone, Credit Limit, and Running Balance.
- **Credit Limit Progress Bar:** Amber alert at $\ge 80\%$, Red lock at $\ge 100\%$.
- **Repayment with Money Receipt (MR No.):** Cash collections log formal sequential Money Receipt serial numbers for dispute-free accounting.
- **1-Click WhatsApp Due Notice:** Normalizes phone numbers strictly to `https://wa.me/8801XXXXXXXXX` and pre-fills polite Bengali payment reminder text with the customer's exact balance.

### 5.5 Analytics Dashboard & Live Cash Reconciliation (`DashboardPage.tsx`)
- **Segregated Cash Drawer Metrics:**
  - **কাঁচা নগদ ড্রয়ার (Physical Cash in Till):** $\text{Sales Cash} + \text{Repayments Cash} - \text{Refunds Cash}$. Matches physical notes in the register.
  - **ডিজিটাল এমএফএস ও ব্যাংক (Digital Collections):** bKash, Nagad, and Bank collections tracked independently.
- **Owner-Protected Profit:** Daily & Monthly Gross Profit figures masked behind 4-digit PIN.
- **Actionable FEFO Clearance Widget:** Lots expiring within 15 days get a flashing red badge and a 1-click **[ 🏷️ বিশেষ ছাড়ে বিক্রয় (Promotional Sale) ]** button loading the lot directly into the POS cart at a clearance discount.
- **1-Click Streamed SQL Backup:** Direct binary stream download (`pos_backup_YYYYMMDD_HHmmss.sql`) with Owner PIN gate, consuming zero RAM.

---

## 6. Verification & Quality Assurance Plan

### Automated & Static Verification:
1. `pnpm build` in `frontend/` compiling cleanly with 0 TypeScript errors and 0 lint warnings.
2. Responsive layout verification ensuring zero vertical scrolling at $1366 \times 768$ and seamless scaling to $1920 \times 1080$.

### End-to-End Business Flow Scenarios:
1. **Auth & Security:** Auto-issuing cashier session $\to$ verifying Owner PIN escalation $\to$ testing 5-minute inactivity auto-lock.
2. **Rapid POS Billing:** Hardware barcode scan simulation $\to$ FEFO lot auto-assignment $\to$ bargaining price override $\to$ negative inventory handling $\to$ quick cash chip change calculation $\to$ dual print preview.
3. **Shipment Intake & Barcodes:** Entering 3 cartons + 4 loose bottles of Karate 2.5 EC $\to$ verifying 64 base units added to store stock $\to$ generating 50x25mm thermal barcode sticker.
4. **Quarantine & Returns:** Processing return of damaged chemical $\to$ confirming automatic quarantine lock $\to$ executing supervisor disposal write-off.
5. **Khata & Repayment:** Recording partial due payment $\to$ verifying Money Receipt generation $\to$ validating WhatsApp link format.
6. **Executive Backup:** Triggering 1-click SQL backup stream download and confirming valid SQL file output.
