---
name: pos-maintenance
description: Maintenance, bug fixing, feature development, and invariant enforcement guide for the Rajib Enterprise POS & Inventory system. Use whenever modifying backend services, frontend UI, customer ledgers, inventory lots, POS sales, sales returns, or writing tests in this repository.
---

# Rajib Enterprise POS & Inventory — Repository Maintenance & Evolution Guide

This skill serves as the single source of institutional memory, domain rules, and engineering standards for maintaining, debugging, and extending the **Rajib Enterprise Agrochemical POS & Inventory System**.

Every agent working in this repository must operate under these principles: **real-world commercial pragmatism, strict data invariants, zero AI slop, and evidence-first verification.**

---

## 1. System Architecture & Tech Stack

### Monorepo Layout
- **Frontend (`frontend/`)**:
  - React 19, Vite 8, TypeScript 5.7.
  - Tailwind CSS v4 via `@tailwindcss/vite` (configured in `src/index.css` via `@import 'tailwindcss';`).
  - UI Library: Custom shadcn/Radix-compatible primitives (`@/components/ui/`).
  - Path alias: `@/` points to `frontend/src/`.
- **Backend (`backend-python/`)**:
  - Python 3.12+, FastAPI, Uvicorn.
  - SQLAlchemy 2.0 (Async Engine & Async Sessions), SQLite with WAL mode (`pos.db`).
  - Pydantic v2 with `CamelModel` (`app/schemas/base.py`) for automatic camelCase JSON serialization.
  - Authentication: JWT Bearer tokens with BCrypt password hashing.
  - Test Runner: `pytest` with `pytest-asyncio` (`backend-python/.venv/bin/pytest`).

---

## 2. Core Business Invariants & Domain Rules

### A. Agrochemical Dealership Realities (Syngenta Dealership)
1. **Pesticide Ordinance 1971 & Expiry Compliance**:
   - Every product lot has an explicit `expiry_date`.
   - Expired lots (`expiry_date <= today`) are strictly forbidden from sale at checkout.
   - When lots expire or items are returned damaged, they are automatically quarantined to `QUARANTINE` location.
2. **Stock Locations**:
   - `DOKAN`: Active counter shop inventory available for sale.
   - `GODOWN`: Bulk warehouse storage.
   - `QUARANTINE`: Damaged, leaked, or expired stock awaiting return to vendor or safe chemical disposal.
3. **FEFO Inventory Allocation**:
   - Stock sales prioritize First-Expired-First-Out (`expiry_date ASC, id ASC`).

### B. Customer Accounts & Credit Ledger Invariants
1. **Strictly Non-Negative Dues**:
   - Customers have either positive debt (`current_due > 0.00`) or are settled (`current_due == 0.00`).
   - **Never introduce negative due balances or fake "Advance Deposit" abstractions**.
2. **Trap B (Due Adjustment Overflow on Returns)**:
   - When a customer returns goods on an invoice that was bought on credit:
   - If refund amount $\le$ customer due: reduce `current_due` by refund amount.
   - If refund amount $>$ customer due: the excess amount is paid out as cash or stored as store credit, **never allowing customer debt to become negative**.
3. **Repayment Restrictions**:
   - Customer payments cannot exceed their outstanding balance.
   - Settled customers (`current_due == 0.00`) cannot make payments.
4. **Bangladeshi Mobile Phone Formatting**:
   - Must strictly match `01[3-9]\d{8}` (11 digits starting with 01).
   - Strip leading `880` country code automatically.

### C. Precision & Sequencing Standards
1. **Numeric Precision**:
   - **Quantities**: Strictly 3 decimal places (`Decimal("0.001")`) for weights and liquids (KG, LITER, BAG).
   - **Monetary Values**: Strictly 2 decimal places (`Decimal("0.01")`) for BDT transactions.
2. **7-Digit Document Sequences**:
   - Sales Invoices: `INV-YYYYMMDD-0000001`
   - Customer Due Receipts: `DUE-YYYYMMDD-0000001`
   - Sales Returns: `RET-YYYYMMDD-0000001`
   - Stock Adjustments: `ADJ-YYYYMMDD-0000001`
   - Sequence rollover occurs at `9,999,999` $\rightarrow$ `1`.

### D. Hardware & Counter Ergonomics
1. **Printing**:
   - POS Counter: Standard 80mm ESC/POS thermal slips.
   - Formal Billing: Standard A4 invoices.
2. **Power Outages & Hardware Recovery**:
   - POS carts must be recoverable if power cuts occur before printer execution.
   - Cashier workflow must be keyboard-friendly (arrow navigation, F2 focus, rapid barcode scanning).

---

## 3. The 4 Operational Maintenance Runbooks

### Runbook 1: Implementing a New Client Feature

When the client requests a new feature:

1. **YAGNI & Practicality Critique**:
   - Ask: Does this work during a power outage? Will it slow down counter checkouts?
   - Resist speculative abstractions (no microservices, extra caching layers, or unnecessary libraries).
2. **End-to-End Implementation (No 3-File Lazy Patches)**:
   - When introducing or altering a domain concept, touch every layer:
     1. Database Model (`app/models/`) & SQLite table migration.
     2. Pydantic Schemas (`app/schemas/`) with strict validation and `CamelModel`.
     3. Service Layer (`app/services/`) with transactional atomicity.
     4. Router Endpoint (`app/routers/`).
     5. Frontend Types & API Client (`frontend/src/`).
     6. Frontend UI Components (matching system theme).
     7. Dedicated Unit & Integration Tests.
3. **Execution Plan**:
   - Write an implementation plan chunking tasks logically.
   - Obtain user approval before modifying code.

---

### Runbook 2: Bug Triage & Invariant Hardening

When a bug is reported or data integrity is questioned:

1. **Enforce the 3-Layer Invariant Check**:
   - **Layer 1: Frontend Input Masking**:
     - Block invalid characters at the keystroke level (e.g. block minus sign on cash inputs).
     - Disable unmodified Save buttons to prevent redundant write locks.
   - **Layer 2: API & Pydantic Validation**:
     - Add `Field(ge=Decimal("0.00"))` on monetary inputs.
     - Add `@field_validator` for string trimming and regex matching.
     - Return standardized HTTP error payloads (`ErrorResponse`).
   - **Layer 3: Database Engine Protection**:
     - Ensure SQLite `PRAGMA foreign_keys = ON` and `PRAGMA journal_mode = WAL`.
     - Guard against nulls with database-level defaults.
2. **TDD Bug Fix**:
   - Add a reproducing test case in `backend-python/tests/`.
   - Apply the fix across all 3 layers.
   - Verify the test turns green and no other tests break.

---

### Runbook 3: UI/UX Evolution ("No AI Slop" Standard)

When modifying or designing user interfaces:

1. **Strict Theme Coherence**:
   - Always match the existing Clean Slate styling: Tailwind CSS v4, slate neutral palette (`border-slate-200/90`, `bg-slate-50`, `text-slate-700`).
   - Never inject flashy, unrequested gradients, oversized cards, or generic AI widgets.
2. **Aggressive Pruning of Dead UI**:
   - If a button, menu item, or badge does not work or has no backend backing, **delete it immediately**.
   - Avoid popup/modal clutter: prefer clean inline controls or compact drawers.
3. **Standardized Reusable Components**:
   - Universal Refresh: Use `<RefreshButton />` (`frontend/src/components/ui/RefreshButton.tsx`) across all data tables and dashboards.
   - Date Filtering: Use `<DateRangeFilter />`.
   - Modals: Use shadcn Radix-based dialogs with proper focus trapping and keyboard exit (`Escape`).

---

### Runbook 4: Client Requirement Evolution & Database Migrations (Alembic)

When a business requirement changes or database schema evolves (e.g. adding columns or tables):

1. **Alembic Schema Evolution**:
   - Never rely on `create_all` for existing tables.
   - Generate an automated migration revision:
     ```bash
     cd backend-python && .venv/bin/alembic revision --autogenerate -m "describe_change"
     ```
   - Review the generated script in `backend-python/alembic/versions/` (ensure `render_as_batch=True` is maintained for SQLite compatibility).
   - Apply migration:
     ```bash
     cd backend-python && .venv/bin/alembic upgrade head
     ```
2. **Clean Deprecation & Backward Compatibility**:
   - When dropping fields (e.g., father name or advance due), remove from UI and print templates.
   - Keep DB columns nullable in legacy records until a formal migration drops them.

---

## 4. Performance & Hardware Standards

1. **Lightweight In-Memory Data Caching (Zero External Bloat)**:
   - Use `apiCache` (`frontend/src/api/cache.ts`) and `useQuery` (`frontend/src/api/useQuery.ts`).
   - Mutations on `/sales`, `/returns`, `/customers`, and `/inventory` automatically invalidate associated cache keys.
   - The universal `<RefreshButton />` serves as the manual cache-busting trigger (`forceRefresh: true`).
2. **Pure 80mm Thermal Receipt Printing**:
   - All thermal slips are styled with `@page { size: 80mm auto; margin: 0; }` in `frontend/src/index.css`.
   - Continuous roll printing with `height: auto` and `page-break-after: avoid` eliminates blank paper ejection.
   - A4 invoices use `@page a4-page { size: A4 portrait; margin: 8mm; }`.

---

## 5. The Non-Negotiable Quality & Verification Gate

**The Iron Law: Never claim completion, fixes, or passing state without fresh, reproducible terminal verification.**

### Standard Verification Commands
Before committing or presenting work to the user, run and confirm:

1. **Backend Test Suite**:
   ```bash
   cd backend-python && .venv/bin/pytest -v
   ```
   - Must achieve **100% pass rate** (65+ tests passing across all 21 test files, 0 failures, 0 broken).
2. **Frontend Typecheck & Build**:
   ```bash
   cd frontend && pnpm exec tsc --noEmit && pnpm run build
   ```
   - Must produce **0 TypeScript errors** and exit with code `0`.
3. **Git Commit & Push**:
   ```bash
   git add <specific-files>
   git commit -m "type(scope): concise explanation of change"
   git push origin main
   ```

---

## 5. Common Gotchas & Troubleshooting

- **SQLite AsyncConnection vs Engine in Sequences**:
  - `session.bind.url` causes an `AttributeError` when an `AsyncConnection` is bound.
  - Always check: `bool(bind and getattr(bind, "dialect", None) and bind.dialect.name == "sqlite")`.
- **Pydantic Null-Safety in DTO Mappers**:
  - Optional relationships (e.g. lot without product or sale without cashier) must use fallback defaults: `(lot.product.name_en or "") if lot and lot.product else ""`.
  - Monetary values must use `or Decimal("0.00")` to prevent Pydantic `NoneType` crashes on legacy records.
- **CamelModel Serialization**:
  - Pydantic models inheriting from `CamelModel` convert `snake_case` Python attributes to `camelCase` in JSON responses.
  - In frontend TypeScript interfaces, always use `camelCase` properties (e.g. `productCode`, `totalStock`, `currentDue`).
- **SQLite Concurrency & Locking**:
  - SQLite with WAL allows multiple concurrent readers and 1 writer. Keep database transactions tight and short.
  - Avoid holding long-lived write locks across external network or I/O calls.
