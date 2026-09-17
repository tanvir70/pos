# Phase 2 Brief: Global State Engine & Security Contexts

**Plan Reference:** Phase 2 from `docs/superpowers/plans/2026-09-17-high-performance-frontend-terminal.md`  
**Spec Reference:** `docs/superpowers/specs/2026-09-17-high-performance-frontend-terminal-design.md`  

---

## Objectives

1. **Authentication & Role Escalation (`src/context/AuthContext.tsx`)**:
   - Zero-friction auto-handshake: On startup, if no valid JWT token exists in `localStorage`, call `POST /api/auth/cashier-session` and initialize `ROLE_CASHIER`.
   - Owner PIN Escalation: Implement `unlockWithOwnerPin(pin: string)` calling `POST /api/auth/verify-pin` (default: `1234`). On success, escalate role to `ROLE_OWNER` and store token in `pos_auth_token`.
   - Inactivity Watchdog: Implement 5-minute inactivity auto-lock (`300,000ms`) monitoring user interaction events (`mousemove`, `keydown`, `touchstart`, `click`, `scroll`). Automatically downgrade back to `ROLE_CASHIER` when idle.
   - Owner PIN Modal: Accessible modal dialog with masked input and integrated `TouchNumpad` for counter touchscreens.

2. **Bengali Error Notification Engine (`src/context/ToastContext.tsx`)**:
   - Stacked alert toast container fixed in upper right corner (`fixed top-4 right-4 z-[9999]`).
   - Semantic toast types: `success`, `error`, `warning`, `info`.
   - Automatic translation of backend RFC 7807 problem details and error codes:
     - `INVALID_PIN` $\to$ "ভুল পিন কোড! সঠিক ৪ ডিজিটের পিন লিখুন।"
     - `NEGATIVE_STOCK_NOT_ALLOWED` $\to$ "স্টকে পর্যাপ্ত পণ্য নেই।"
     - `CUSTOMER_CREDIT_EXCEEDED` $\to$ "এই গ্রাহকের বাকির সর্বোচ্চ সীমা অতিক্রম করেছে!"
     - `LOT_NOT_FOUND` $\to$ "অনুরোধকৃত ব্যাচ/লট ডেটাবেসে পাওয়া যায়নি।"
     - 401 Unauthorized $\to$ "আপনার সেশনটি শেষ হয়েছে।"
     - 403 Forbidden $\to$ "এই ক্রিয়াকলাপের জন্য মালিক মোড প্রয়োজন।"

3. **Centralized POS Cart Engine (`src/context/CartContext.tsx`)**:
   - Centralize billing cart state out of `PosCounter.tsx`.
   - Continuous auto-save to `sessionStorage` (`pos_active_cart_v1`) to make ongoing transactions immune to browser refreshes or tab switches.
   - Memoized cart operations:
     - `addToCart`: FEFO lot auto-defaulting, duplicate item quantity incrementation.
     - `adjustQuantity` / `setQuantity`: Integer & decimal packaging stepper.
     - `setUnitPrice`: In-flight bargaining price override.
     - `selectLot`: Manual lot override for physical chemical batch matching.
     - `removeItem` / `clearCart`.
   - Memoized financial calculations using `currency.ts` fixed-point math:
     - `subtotal`, `computedDiscount`, `preRoundTotal`, `roundOffDeficit`, `finalTotalAmount`.
     - `cashPaid`, `digitalPaid`, `totalPaid`, `liveDue`, `changeToReturn`.
     - `totalPurchaseCost`, `totalGrossProfit`, `grossProfitMargin`.
   - 1-Click Quick Round-Off helper (`applyQuickRoundOff`).

4. **HTTP Client Hardening (`src/api/client.ts`)**:
   - Automatically inject `Authorization: Bearer <token>` from `localStorage`.
   - Automatically inject unique `X-Idempotency-Key` (UUID) for mutating requests (`POST`, `PUT`, `DELETE`).
   - Add typed API endpoints in `endpoints.ts` for auth (`createCashierSession`, `verifyOwnerPin`).

5. **Root Provider Wiring (`src/App.tsx` & `src/components/Navbar.tsx`)**:
   - Wrap application tree in `<ToastProvider>`, `<AuthProvider>`, and `<CartProvider>`.
   - Refactor `Navbar.tsx` to consume `useAuth()` and `useToast()`, eliminating duplicate PIN modal code.

## Verification Requirements
- `pnpm build` must pass with 0 errors.
- Unit test suite (`src/tests/phase2-contexts.test.ts`) must execute cleanly via Node.js verifying math precision, session persistence, ApiError mapping, and UUID generation.
