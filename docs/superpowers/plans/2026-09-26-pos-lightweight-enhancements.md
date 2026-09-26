# Lightweight POS Enhancements (1.C, 1.D, 2.A) Implementation Plan

- **Goal:** Implement lightweight data caching (1.C), pure thermal print CSS optimization (1.D), and Alembic database migration management (2.A) without bloat or over-engineering.
- **Architecture:** 
  - Zero-dependency in-memory Stale-While-Revalidate (SWR) cache in native TypeScript client with automatic mutation invalidation and `<RefreshButton />` cache-busting.
  - Pure `@media print` CSS rules for 80mm thermal receipt printing, eliminating blank page ejection and browser URL headers.
  - Async Alembic migration environment wired directly to `app.config.get_settings()` and SQLAlchemy models, with an automated initial schema baseline.
- **Tech Stack:** React 19, Tailwind CSS v4, TypeScript 5.7, FastAPI, SQLAlchemy 2.0 Async, Alembic 1.20, SQLite (WAL).

---

## Proposed Changes & File Boundaries

### Frontend (`frontend/src/`)
1. **`frontend/src/api/cache.ts` [NEW]**:
   - Lightweight, zero-dependency in-memory cache registry (`Map<string, CacheEntry>`).
   - Supports configurable TTL (default 30s), stale-while-revalidate serving, and wildcard/prefix invalidation.
2. **`frontend/src/api/client.ts` [MODIFY]**:
   - Integrate caching into `client.get<T>(url, { ttlMs, forceRefresh })`.
   - On mutation (`client.post`, `client.put`, `client.delete`), automatically invalidate associated cache keys (e.g., sales mutations invalidate `/api/sales`, `/api/inventory`, `/api/dashboard`, `/api/customers`).
3. **`frontend/src/api/useQuery.ts` [NEW]**:
   - 35-line native React hook `useQuery<T>(key, fetcher, options)` providing instant cached data, `isLoading`, `error`, and `refetch()`.
4. **`frontend/src/index.css` [MODIFY]**:
   - Refine `@media print` with explicit `@page { size: 80mm auto; margin: 0; }` and `-webkit-print-color-adjust: exact`.
   - Add specialized `@page a4 { size: A4 portrait; margin: 8mm; }` for A4 invoice generation.

### Backend (`backend-python/`)
5. **`backend-python/alembic.ini` [NEW]**:
   - Standard Alembic configuration file configured to use async environment.
6. **`backend-python/alembic/env.py` [NEW]**:
   - Wired to `app.config.get_settings().DATABASE_URL` and `app.models.base.Base.metadata`.
   - Supports both offline SQL generation and online async migration execution.
7. **`backend-python/alembic/script.py.mako` [NEW]**:
   - Standard migration template.
8. **`backend-python/alembic/versions/` [NEW]**:
   - `0001_initial_schema.py`: Baseline migration capturing existing tables and invariants.
9. **`backend-python/tests/test_migrations.py` [NEW]**:
   - Automated pytest testing Alembic migration execution (`upgrade head` and schema parity).

---

## Tasks Decomposition

### Task 1: Lightweight In-Memory Data Caching & Auto-Invalidation (1.C)
- **Step 1:** Create `frontend/src/api/cache.ts` with lightweight `ApiCache` class (get, set, invalidate, clear).
- **Step 2:** Integrate `apiCache` into `frontend/src/api/client.ts`:
  - `client.get`: serve from cache if fresh; fetch & cache if missing or forceRefresh.
  - `client.post / put / delete`: automatic cache pattern invalidation.
- **Step 3:** Create `frontend/src/api/useQuery.ts` for clean hook consumption.
- **Step 4:** Wire `<RefreshButton />` to trigger `forceRefresh: true` on manual refresh.
- **Step 5:** Verify with `pnpm exec tsc --noEmit && pnpm run build`.

### Task 2: Pure Thermal Print CSS & Paper Ejection Optimization (1.D)
- **Step 1:** Update `frontend/src/index.css` `@media print` rules:
  - Add `@page { size: 80mm auto; margin: 0; }`.
  - Add color adjust properties (`print-color-adjust: exact`).
  - Restrict thermal receipt print container to 80mm width and auto height to stop trailing blank page feeds.
- **Step 2:** Ensure A4 invoice print maintains its proper portrait A4 sizing (`size: A4 portrait`).
- **Step 3:** Verify build and visual print rules.

### Task 3: Alembic Database Migration Setup & Initial Baseline (2.A)
- **Step 1:** Initialize async Alembic configuration in `backend-python/alembic/` and `backend-python/alembic.ini`.
- **Step 2:** Wire `alembic/env.py` to import `Base.metadata` from `app.models` and read `DATABASE_URL` from `app.config`.
- **Step 3:** Generate baseline revision `0001_initial_schema.py`.
- **Step 4:** Stamp current database to head: `.venv/bin/alembic stamp head`.
- **Step 5:** Add `backend-python/tests/test_migrations.py` to verify Alembic integrity.
- **Step 6:** Run full pytest suite: `.venv/bin/pytest -v`.

---

## Verification Plan
1. **Frontend Typecheck & Build**:
   `cd frontend && pnpm exec tsc --noEmit && pnpm run build` (Must be 0 errors).
2. **Backend Test Suite**:
   `cd backend-python && .venv/bin/pytest -v` (Must achieve 100% pass across all test suites).
3. **Alembic Verification**:
   `cd backend-python && .venv/bin/alembic current && .venv/bin/alembic check` (Must confirm schema matches models).
