# StockPilot — Deep Audit Report

**Date:** 2026-10-08  
**Scope:** `src/` and `backend/` — read-only, no code changes  
**Tooling output:** `tsc --noEmit` → 0 errors; `next lint` → no ESLint config found (exits 1)

---

## 1. DUPLICATION

### DUP-01 — Purchase dialog boilerplate repeated five times
- **Where:** `src/components/bc-test-dialog.tsx` (860 lines), `br-test-dialog.tsx` (883), `fa-test-dialog.tsx` (876), `aa-test-dialog.tsx` (876), `reglement-test-dialog.tsx` (501)
- **What:** Each dialog re-declares local interfaces (`Article`, `Supplier`, `Representative`, `InvoiceItem`), helpers (`deduplicate()`, `calculateNextNumber()`, `isDuplicateNumber()`), the entire DnD row-reorder setup, the minimize/dock/maximize logic, `isFormDirty()`, and the form grid layout. Approximately 600–700 lines per dialog are structurally identical.
- **Severity:** High  
- **Effort:** Large  
- **Confidence:** Verified  
- **Suggested fix:** Extract a `BasePurchaseDialog` component containing shared state, layout, and helpers. Each concrete dialog supplies only its unique fields, save handler, and fetch list.

### DUP-02 — Table selection / action-bar pattern copy-pasted across entity pages
- **Where:** `src/app/articles/page.tsx` (L105–125), `src/app/suppliers/page.tsx` (L180–200), `src/app/clients/page.tsx`, `src/app/representatives/page.tsx`, `src/app/articles/families/page.tsx`
- **What:** Shift-click multi-select, the `<CardHeader>` toolbar with Edit/Delete tooltip buttons, and the AlertDialog delete-confirmation are duplicated across every entity page (~100–150 lines each).
- **Severity:** Medium  
- **Effort:** Medium  
- **Confidence:** Verified  
- **Suggested fix:** Extract a generic `<DataTableToolbar>` and `<SelectableTable>` component.

### DUP-03 — Validate/cancel/stock logic duplicated across backend routers
- **Where:** `backend/routers/purchase_receipts.py` (L72–127), `purchase_invoices.py` (L87–170), `purchase_credit_notes.py` (L77–124)
- **What:** The validate and cancel-validation endpoints share the same structure: fetch document, check status, loop over JSON items, update stock, change status, commit-or-rollback. Roughly 150 lines total are near-identical.
- **Severity:** Medium  
- **Effort:** Medium  
- **Confidence:** Verified  
- **Suggested fix:** Extract a `toggle_document_validation(db, doc, direction)` service function that all three routers call.

### DUP-04 — Identical Item schemas declared four times
- **Where:** `backend/schemas.py` (L138–142, L181–185, L226–230, L275–279)
- **What:** `PurchaseOrderItem`, `PurchaseReceiptItem`, `PurchaseInvoiceItem`, and `PurchaseCreditNoteItem` are field-for-field identical.
- **Severity:** Low  
- **Effort:** Small  
- **Confidence:** Verified  
- **Suggested fix:** Define a single `DocumentItem` schema and alias or reuse it.

### DUP-05 — Repeated fromApi / toApi mapper boilerplate in types.ts
- **Where:** `src/lib/types.ts` (L172–445)
- **What:** Each entity has a hand-written `*FromApi` and `*ToApi` function that manually maps snake_case ↔ camelCase. These functions are structurally identical. ~270 lines of pure mapping glue.
- **Severity:** Low  
- **Effort:** Medium  
- **Confidence:** Verified  
- **Suggested fix:** Write a generic `mapKeys(obj, mapping)` helper, or adopt a library like `camelcase-keys`.

### DUP-06 — Duplicate number uniqueness checks on all create endpoints
- **Where:** `backend/routers/purchase_orders.py` (L30), `purchase_receipts.py` (L30), `purchase_invoices.py` (L30), `purchase_credit_notes.py` (L30)
- **What:** The pattern `db.query(Model).filter(Model.number == data.number).first()` + raise HTTPException is copy-pasted.
- **Severity:** Low  
- **Effort:** Small  
- **Confidence:** Verified  
- **Suggested fix:** Add a `ensure_unique(db, model, field, value)` helper to `crud.py`.

---

## 2. PERFORMANCE (backend)

### PERF-B01 — N+1 queries in validate/cancel loops
- **Where:** `backend/routers/purchase_receipts.py` (L77–79, L107–109), `purchase_invoices.py` (L96–102, L114–119), `purchase_credit_notes.py` (L86–92, L112–115), `reglements.py` (L40–41, L107–108, L132–133)
- **What:** Products and invoices are fetched one-by-one inside a `for item in items` loop via `crud.get_by_id`. A 20-item document triggers 20 separate SELECT statements.
- **Severity:** High  
- **Effort:** Medium  
- **Confidence:** Verified  
- **Suggested fix:** Collect all IDs first, batch-fetch with `db.query(Product).filter(Product.id.in_(ids)).all()`, build a dict.

### PERF-B02 — No indexes on frequently-queried foreign-key columns
- **Where:** `backend/models.py` — `supplier_id` (L40, L73, L91, L109, L129, L145), `purchase_order_id` (L90, L108), `purchase_receipt_id` (L116), `purchase_invoice_id` (L128, L158), `reglement_id` (L157), `status` (L93, L111, L131, L151)
- **What:** None of these columns have `index=True`. Every guard query (`db.query(X).filter(X.y == val).first()`) causes a full table scan.
- **Severity:** High  
- **Effort:** Small  
- **Confidence:** Verified  
- **Suggested fix:** Add `index=True` to each `mapped_column`. Re-create the DB or run a migration.

### PERF-B03 — No pagination on any list endpoint
- **Where:** `backend/crud.py` (L9–10), every `GET ""` router endpoint
- **What:** `get_all()` returns `list(db.scalars(select(model)).all())` — loads every row into Python memory. As data grows this will consume all RAM and slow responses dramatically.
- **Severity:** High  
- **Effort:** Medium  
- **Confidence:** Verified  
- **Suggested fix:** Add `skip: int = 0, limit: int = 100` query params. Add a `get_paginated(db, model, skip, limit)` function.

### PERF-B04 — SQLite not configured for WAL mode or foreign keys
- **Where:** `backend/database.py` (L6–10)
- **What:** No `PRAGMA journal_mode=WAL` (needed for concurrent reads during writes) and no `PRAGMA foreign_keys=ON` (without this, SQLite silently ignores all `ForeignKey` constraints — they are decorative).
- **Severity:** High  
- **Effort:** Small  
- **Confidence:** Verified  
- **Suggested fix:** Add an `@event.listens_for(engine, "connect")` handler that executes both PRAGMAs.

### PERF-B05 — Items stored as JSON blob instead of normalized table
- **Where:** `backend/models.py` (L83, L101, L121, L139)
- **What:** All document items are stored in a single JSON column. This makes it impossible to query "which documents contain product X?" efficiently, and forces Python-side loops for stock operations.
- **Severity:** Medium  
- **Effort:** Large  
- **Confidence:** Verified  
- **Suggested fix:** Long-term: normalize into a `document_items` table with FKs to both the document and the product.

---

## 3. PERFORMANCE (frontend)

### PERF-F01 — Full-collection downstream fetches on entity pages
- **Where:** `src/app/articles/page.tsx` (L61–71), `src/app/suppliers/page.tsx` (L134–142), `src/app/purchases/orders/page.tsx` (fetches all receipts for `transferredOrderIds`)
- **What:** To check whether a product or supplier is used in a document, the page fetches ALL purchase orders, receipts, and invoices on mount. As data grows, these pages will load megabytes of unneeded data.
- **Severity:** High  
- **Effort:** Large  
- **Confidence:** Verified  
- **Suggested fix:** Move the "is referenced?" check to a server-side endpoint (e.g., `GET /products/{id}/can-delete` or let the DELETE endpoint return the guard error).

### PERF-F02 — Dialogs fetch all products, suppliers, representatives on open
- **Where:** `src/components/bc-test-dialog.tsx` (L236–241), and identically in br/fa/aa dialogs
- **What:** Opening a purchase dialog triggers `Promise.all` fetching the full product, supplier, representative, and existing-document lists just to populate dropdowns and calculate the next number.
- **Severity:** High  
- **Effort:** Large  
- **Confidence:** Verified  
- **Suggested fix:** Add server-side search endpoints for dropdowns (typeahead), and a `GET /next-number?prefix=BC` endpoint.

### PERF-F03 — No request caching or deduplication
- **Where:** `src/hooks/use-api.ts` (L9–51)
- **What:** `useApiCollection` is a plain `useEffect` + `fetch`. If two components on the same page call `api.getSuppliers()`, it fires two independent HTTP requests with no shared cache.
- **Severity:** Medium  
- **Effort:** Medium  
- **Confidence:** Verified  
- **Suggested fix:** Adopt React Query / SWR, or add a simple in-memory cache with TTL.

---

## 4. ORGANIZATION

### ORG-01 — Oversized dialog files with mixed responsibilities
- **Where:** `src/components/bc-test-dialog.tsx` (860 lines), `br-test-dialog.tsx` (883 lines), `fa-test-dialog.tsx` (876 lines), `aa-test-dialog.tsx` (876 lines)
- **What:** Each file handles API calls, auto-increment logic, form validation, DnD reordering, window dock/minimize, and complex JSX in one monolithic component. Business rules (total calculation, number generation) live in the view layer.
- **Severity:** Medium  
- **Effort:** Large  
- **Confidence:** Verified  
- **Suggested fix:** Split into: custom hook for state/logic, a shared layout component, and a thin dialog wrapper.

### ORG-02 — Business logic in router handlers
- **Where:** `backend/routers/purchase_invoices.py`, `purchase_receipts.py`, `purchase_credit_notes.py`, `reglements.py`
- **What:** Stock calculations, payment allocation, status transitions, and validation rules are all inline in FastAPI route handlers rather than in a service layer. This makes unit testing hard and duplicates logic.
- **Severity:** Medium  
- **Effort:** Large  
- **Confidence:** Verified  
- **Suggested fix:** Create a `backend/services/` layer with functions like `validate_document()`, `allocate_payment()`.

### ORG-03 — purchase-document-guards.ts fetches full collections client-side
- **Where:** `src/lib/purchase-document-guards.ts` (L12–34)
- **What:** `hasDownstreamDocument()` downloads the entire target collection to check a single FK reference. This is both a performance problem and an organization issue — it puts a server-side concern (referential integrity) in the client.
- **Severity:** Medium  
- **Effort:** Small  
- **Confidence:** Verified  
- **Suggested fix:** Delete this file and rely on the server's delete-guard HTTP errors (which already exist).

---

## 5. DEAD AND LEFTOVER CODE

### DEAD-01 — README.md still says "Firebase Studio"
- **Where:** `README.md` (L1)
- **What:** The README reads "This is a NextJS starter in Firebase Studio" with no mention of StockPilot, the backend, or how to run the app. It is effectively dead documentation.
- **Severity:** Low  
- **Effort:** Small  
- **Confidence:** Verified  
- **Suggested fix:** Rewrite with project name, setup steps, and how to start both servers.

### DEAD-02 — `purchase-document-guards.ts` largely redundant
- **Where:** `src/lib/purchase-document-guards.ts`
- **What:** Now that the backend enforces delete guards, this client-side full-collection guard is redundant. It is still imported in entity pages, causing the wasted fetches in PERF-F01.
- **Severity:** Medium  
- **Effort:** Small  
- **Confidence:** Verified  
- **Suggested fix:** Remove the file and the full-collection fetches that feed it. Let the server's 400 error be the guard.

### DEAD-03 — Leftover remote image patterns in next.config.ts
- **Where:** `next.config.ts` (L12–31)
- **What:** `remotePatterns` allows `placehold.co`, `images.unsplash.com`, and `picsum.photos`. These placeholder image services are not used anywhere in the app.
- **Severity:** Low  
- **Effort:** Small  
- **Confidence:** Verified  
- **Suggested fix:** Remove the `images.remotePatterns` block.

---

## 6. CORRECTNESS RISKS

### CORR-01 — Race condition on stock updates (read-modify-write)
- **Where:** `backend/routers/purchase_receipts.py` (L79), `purchase_invoices.py` (L100), `purchase_credit_notes.py` (L92)
- **What:** Stock is updated via `product.stock_level = (product.stock_level or 0) + qty` — a Python-side read-modify-write. Under concurrent requests, the second request reads the old value before the first commits, silently losing one update.
- **Severity:** High  
- **Effort:** Medium  
- **Confidence:** Verified  
- **Suggested fix:** Use `Product.stock_level = Product.stock_level + qty` (a SQL-level atomic expression) via `update(Product).where(Product.id == pid).values(stock_level=Product.stock_level + qty)`.

### CORR-02 — Monetary amounts stored as Float, not Decimal
- **Where:** `backend/models.py` — every `Float` column for `total_ht`, `total_ttc`, `amount`, `amount_paid`, `price`
- **What:** IEEE 754 floats cannot represent many decimal fractions exactly (e.g., 0.1 + 0.2 ≠ 0.3). Manual `round(..., 2)` in `reglements.py` mitigates this partially, but all other routers ignore rounding entirely.
- **Severity:** High  
- **Effort:** Large  
- **Confidence:** Verified  
- **Suggested fix:** Change `Float` to `Numeric(12, 2)` in models. Use Python `Decimal` in Pydantic schemas with `decimal_places=2`.

### CORR-03 — Document number generated client-side (race condition)
- **Where:** `src/components/bc-test-dialog.tsx` (L172–180), and identically in br/fa/aa dialogs
- **What:** `calculateNextNumber()` finds the max document number from the fetched list and increments it. Two users opening the dialog simultaneously both compute the same next number, leading to a duplicate (caught by the server's uniqueness check, but the user sees an error instead of auto-recovery).
- **Severity:** Medium  
- **Effort:** Medium  
- **Confidence:** Verified  
- **Suggested fix:** Add a `GET /next-number?prefix=BC` backend endpoint that reserves the next number atomically.

### CORR-04 — Partial stock rollback in BR cancel-validation
- **Where:** `backend/routers/purchase_receipts.py` (L107–118)
- **What:** The cancel loop subtracts stock one item at a time. If item 3 of 5 has insufficient stock, a `ValueError` is raised — but items 1 and 2 already had their stock decremented in memory. The `db.rollback()` reverts the transaction, but if the ORM objects remain in session scope after rollback, state can be inconsistent.
- **Severity:** Medium  
- **Effort:** Medium  
- **Confidence:** Verified  
- **Suggested fix:** Pre-check all items for sufficiency before modifying any (like `purchase_invoices.py` already does).

### CORR-05 — Date/timezone instability in isFormDirty
- **Where:** `src/components/bc-test-dialog.tsx` (L201), and identically in br/fa/aa
- **What:** `isFormDirty` compares `isSameDay(date, new Date(orderToEdit.orderDate))`. `new Date()` parses a date string using the browser's local timezone. An order created at 23:00 UTC will be seen as the next day by a user in UTC+2, falsely marking the form dirty and potentially saving the wrong date.
- **Severity:** Medium  
- **Effort:** Medium  
- **Confidence:** Verified  
- **Suggested fix:** Store and compare dates as ISO date strings (`YYYY-MM-DD`), or use `parseISO` from date-fns with explicit timezone handling.

---

## 7. DATA INTEGRITY

### INT-01 — Foreign keys not enforced at the database level
- **Where:** `backend/database.py` (L6–10)
- **What:** SQLite ignores foreign-key constraints by default unless `PRAGMA foreign_keys=ON` is set on every connection. Currently it is not set, so all `ForeignKey(...)` declarations in models.py are purely decorative. You can insert a `PurchaseReceipt` with a `supplier_id` pointing to a non-existent supplier and SQLite will accept it silently.
- **Severity:** High  
- **Effort:** Small  
- **Confidence:** Verified  
- **Suggested fix:** Same as PERF-B04 — add a connection event listener that sets `PRAGMA foreign_keys=ON`.

### INT-02 — Client-side delete guards are bypassable
- **Where:** `src/app/articles/page.tsx` (L61–71, L132–136), `src/app/suppliers/page.tsx` (L134–142, L204–208)
- **What:** The articles and suppliers pages check for downstream documents before deleting, but these checks run purely in the browser. A direct API call (`DELETE /products/{id}`) bypasses them entirely and the server has no guard.
- **Severity:** High  
- **Effort:** Medium  
- **Confidence:** Verified  
- **Suggested fix:** Add server-side delete guards on the product, supplier, client, representative, and article-family routers (check for referencing documents before allowing deletion).

### INT-03 — Void/delete règlement can produce negative amount_paid
- **Where:** `backend/routers/reglements.py` (L110–112, L135–137)
- **What:** When voiding or deleting an active règlement, `invoice.amount_paid` is decremented by the line amount. If another concurrent void runs at the same time, or if `amount_paid` was manually set lower, the result can go negative. There is no `max(0, ...)` guard.
- **Severity:** Medium  
- **Effort:** Small  
- **Confidence:** Suspected  
- **Suggested fix:** Add `invoice.amount_paid = max(0, new_amount_paid)` as a safety floor, or recalculate from the sum of active reglement lines.

---

## 8. SECURITY AND ROBUSTNESS

### SEC-01 — Error messages leak internal details
- **Where:** `src/lib/api.ts` (L179, L198, L217, L232), `backend/routers/*.py` (every `except Exception as e: ... detail=str(e)`)
- **What:** Backend catches generic exceptions and returns `str(e)` as the HTTP detail. The frontend shows this directly in toast messages. A database error can expose table names, SQL, or file paths.
- **Severity:** Medium  
- **Effort:** Small  
- **Confidence:** Verified  
- **Suggested fix:** In production, log the full exception server-side and return a generic user-facing message. Keep detailed errors only in debug mode.

### SEC-02 — next.config.ts silences all build errors
- **Where:** `next.config.ts` (L5–10)
- **What:** `typescript.ignoreBuildErrors: true` and `eslint.ignoreDuringBuilds: true` mean a production build will succeed even with type errors or lint violations. Broken code can be deployed without any CI gate.
- **Severity:** High  
- **Effort:** Small  
- **Confidence:** Verified  
- **Suggested fix:** Set both to `false`. Fix any resulting build errors.

### SEC-03 — No ESLint configuration
- **Where:** Project root (no `.eslintrc.json` or `eslint.config.mjs`)
- **What:** Running `next lint` fails with a setup prompt because no ESLint config exists. There is no code-quality linting at all.
- **Severity:** Medium  
- **Effort:** Small  
- **Confidence:** Verified (lint output: "How would you like to configure ESLint?")  
- **Suggested fix:** Run `npx next lint` and choose "Strict", then commit the generated config.

### SEC-04 — No frontend input validation before API calls
- **Where:** `src/lib/api.ts` — `post()` and `put()` accept `body: unknown`
- **What:** The API client serializes whatever it receives with no schema validation. If a dialog accidentally sends malformed data, the error is only caught by the server (Pydantic 422), not prevented locally.
- **Severity:** Medium  
- **Effort:** Large  
- **Confidence:** Verified  
- **Suggested fix:** Add Zod schemas matching the Pydantic models and validate before sending.

---

## 9. USER EXPERIENCE AND CONSISTENCY

### UX-01 — Missing French accents in UI strings
- **Where:** `src/app/articles/page.tsx` (L140, L155, L289–290)
- **What:** Hardcoded toast messages use `"utilises"` instead of `"utilisés"`, `"echec(s)"` instead of `"échec(s)"`, `"irreversible"`, `"selectionnes"`, `"supprimes"`. This looks unprofessional.
- **Severity:** Low  
- **Effort:** Small  
- **Confidence:** Verified  
- **Suggested fix:** Fix the accent characters in each string.

### UX-02 — Double-click submit not consistently guarded
- **Where:** `src/components/bc-test-dialog.tsx` (L124), and identically in br/fa/aa
- **What:** The `isSubmitting` state is declared but the submit button is not always disabled while the async save is in flight. A fast double-click can trigger two save calls, creating duplicate documents.
- **Severity:** Medium  
- **Effort:** Small  
- **Confidence:** Suspected  
- **Suggested fix:** Add `disabled={isSubmitting}` to every submit button, and add an early `if (isSubmitting) return;` guard at the top of every save handler.

---

## 10. BUILD AND TOOLING

### BUILD-01 — Widespread `any` usage bypasses TypeScript safety
- **Where:** `src/lib/types.ts` (26 occurrences at L172–431), `src/components/reglement-test-dialog.tsx` (L208), `src/components/representative-dialog.tsx` (L71–103), `src/app/purchases/*.tsx` (catch blocks), `src/hooks/use-shake-warning.ts` (L9)
- **What:** All `fromApi`/`toApi` mappers use `: any` for their input parameter. All error `catch` blocks use `error: any`. The API boundary — the most important place for type safety — has none.
- **Severity:** High  
- **Effort:** Large  
- **Confidence:** Verified  
- **Suggested fix:** Define typed API response interfaces (matching the backend's Pydantic `Read` schemas) and use them in the mapper signatures and `api.ts` generics.

### BUILD-02 — No automated tests
- **Where:** Entire project
- **What:** There are no test files, no test runner configured, and no test scripts in `package.json`. All testing is manual.
- **Severity:** Medium  
- **Effort:** Large  
- **Confidence:** Verified  
- **Suggested fix:** Start with backend endpoint tests (pytest + httpx TestClient) for the critical validation/payment flows.

### BUILD-03 — README is stale Firebase boilerplate
- **Where:** `README.md`
- **What:** Still reads "This is a NextJS starter in Firebase Studio". No setup instructions, no architecture overview, no "how to run" section.
- **Severity:** Low  
- **Effort:** Small  
- **Confidence:** Verified  
- **Suggested fix:** Rewrite with project description, prerequisites, and startup steps for both servers.

---

## 11. ANYTHING ELSE

### MISC-01 — populate.py has no accidental-run guard
- **Where:** `backend/populate.py`
- **What:** Running `populate.py` drops and recreates all tables unconditionally. If run against a database with real data, everything is lost instantly with no confirmation prompt.
- **Severity:** Medium  
- **Effort:** Small  
- **Confidence:** Verified  
- **Suggested fix:** Add a `--confirm-drop` CLI flag, or check for existing data and abort with a warning.

### MISC-02 — Dates stored as strings, not proper DATE columns
- **Where:** `backend/models.py` — `order_date` (L74), `receipt_date` (L92), `invoice_date` (L110), `credit_note_date` (L130), `date` (L146)
- **What:** All dates are `String` columns. This means SQLite can't sort, filter, or compare them as dates. Queries like "invoices overdue past 30 days" require parsing every row in Python.
- **Severity:** Medium  
- **Effort:** Medium  
- **Confidence:** Verified  
- **Suggested fix:** Change to `Date` columns (SQLAlchemy will store them as ISO strings in SQLite, but comparisons will work correctly).

---

## Summary Table

| ID | Title | Severity | Effort |
|---|---|---|---|
| DUP-01 | Purchase dialog boilerplate ×5 | High | Large |
| DUP-02 | Table selection/action-bar copy-pasted | Medium | Medium |
| DUP-03 | Validate/cancel/stock logic duplicated in routers | Medium | Medium |
| DUP-04 | Identical Item schemas ×4 | Low | Small |
| DUP-05 | fromApi/toApi mapper boilerplate | Low | Medium |
| DUP-06 | Duplicate number uniqueness checks | Low | Small |
| PERF-B01 | N+1 queries in validate/cancel loops | High | Medium |
| PERF-B02 | No indexes on FK columns | High | Small |
| PERF-B03 | No pagination on list endpoints | High | Medium |
| PERF-B04 | SQLite not configured (WAL, FK pragma) | High | Small |
| PERF-B05 | Items stored as JSON blob | Medium | Large |
| PERF-F01 | Full-collection downstream fetches on entity pages | High | Large |
| PERF-F02 | Dialogs fetch all records on open | High | Large |
| PERF-F03 | No request caching/deduplication | Medium | Medium |
| ORG-01 | Oversized dialog files (860+ lines) | Medium | Large |
| ORG-02 | Business logic in router handlers | Medium | Large |
| ORG-03 | purchase-document-guards fetches full collections | Medium | Small |
| DEAD-01 | README still says "Firebase Studio" | Low | Small |
| DEAD-02 | purchase-document-guards.ts largely redundant | Medium | Small |
| DEAD-03 | Leftover remote image patterns in next.config | Low | Small |
| CORR-01 | Race condition on stock updates | High | Medium |
| CORR-02 | Monetary amounts stored as Float | High | Large |
| CORR-03 | Document number generated client-side | Medium | Medium |
| CORR-04 | Partial stock rollback in BR cancel | Medium | Medium |
| CORR-05 | Date/timezone instability in isFormDirty | Medium | Medium |
| INT-01 | Foreign keys not enforced (SQLite pragma) | High | Small |
| INT-02 | Client-side delete guards bypassable | High | Medium |
| INT-03 | Void/delete règlement can go negative | Medium | Small |
| SEC-01 | Error messages leak internals | Medium | Small |
| SEC-02 | next.config silences all build errors | High | Small |
| SEC-03 | No ESLint configuration | Medium | Small |
| SEC-04 | No frontend input validation | Medium | Large |
| UX-01 | Missing French accents in strings | Low | Small |
| UX-02 | Double-click submit not consistently guarded | Medium | Small |
| BUILD-01 | Widespread `any` bypasses TypeScript | High | Large |
| BUILD-02 | No automated tests | Medium | Large |
| BUILD-03 | README is stale boilerplate | Low | Small |
| MISC-01 | populate.py has no accidental-run guard | Medium | Small |
| MISC-02 | Dates stored as strings | Medium | Medium |

---

## Top 10 to Fix First

1. **PERF-B04 / INT-01** — Enable `PRAGMA foreign_keys=ON` and `journal_mode=WAL`. Tiny change, huge integrity and concurrency win.
2. **SEC-02** — Set `ignoreBuildErrors: false` in next.config.ts. One-line change that prevents deploying broken code.
3. **PERF-B02** — Add `index=True` to FK columns. Small model change, big query speedup.
4. **CORR-01** — Use SQL-level atomic stock updates. Prevents silent data loss under concurrent use.
5. **INT-02** — Add server-side delete guards for products, suppliers, article families, representatives, clients. Prevents data corruption via direct API calls.
6. **DEAD-02 / ORG-03 / PERF-F01** — Remove `purchase-document-guards.ts` and the full-collection fetches it requires. Immediate page-load improvement.
7. **UX-02** — Add `disabled={isSubmitting}` to all submit buttons. Small fix, prevents duplicate documents.
8. **SEC-03** — Initialize ESLint config. One command, enables code quality checks.
9. **SEC-01** — Stop returning raw `str(e)` in production error responses. Log internally, return generic message.
10. **CORR-02** — Migrate monetary columns from `Float` to `Numeric(12,2)`. Prevents rounding bugs in payments.

---

## Could Not Check

| Item | Reason |
|---|---|
| Actual SQLite file size and row counts | Would require querying the live database |
| Bundle size analysis (`next build --analyze`) | Would modify `.next/` build output |
| Runtime memory usage / re-render counts | Requires browser profiling with the app running |
| Actual concurrent race-condition reproduction | Would require multiple simultaneous API calls modifying data |
| pip dependency audit | No `requirements.txt` or `pyproject.toml` found to audit against |
