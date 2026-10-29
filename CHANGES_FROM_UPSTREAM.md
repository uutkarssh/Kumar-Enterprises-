# Changes from upstream

This fork diverges meaningfully from the storage model of
[IamRamgarhia/Free-GST-Billing-Software](https://github.com/IamRamgarhia/Free-GST-Billing-Software).
Anyone maintaining this codebase should read this before touching the data layer.

## Architectural changes (Step 2 of the build brief)

### 1. Data layer moved from Express+filesystem to IndexedDB
**Upstream**: `server.js` exposes an Express API over `localhost:47371`. `src/store.js` calls
`fetch('/api/invoices')` etc. The actual records are JSON files in a `data/` folder on disk.
The "CORS lockdown" comment in `server.js` (v1.10.0) restricts the API to localhost origins.

**This app**: all business logic and storage move into the browser. `src/lib/db.ts` is a local
data-access layer backed by **IndexedDB** (via `idb`), with the same logical function signatures
(`listInvoices`, `putInvoice`, `listClients`, …) so the React components above it barely change.
There is **no Express server** and **no `localhost:47371` dependency** at runtime — which is the
core reason the upstream app cannot be installed as a real app on Android (no user-facing Node
runtime on a phone).

### 2. Folder-backed persistence layer (feature-detected)
**Upstream**: the `data/` folder *is* the storage. Copy it to back up.

**This app**: storage is IndexedDB; a folder-backed layer is layered on top using feature
detection (`src/lib/storage.ts`):
- `window.showDirectoryPicker()` (File System Access API) where supported → writes
  `kumar-billing-backup.json` to the chosen folder. Same JSON schema as upstream's `data/` so a
  user can copy the folder across to the desktop build.
- OPFS (Origin Private File System) fallback for Android → saves to app-private storage and
  also downloads a backup file the user can find in Downloads.
- Manual download fallback everywhere.

### 3. Service worker precaches the app shell with zero server dependency
**Upstream**: service worker precaches the shell, but the app still calls `localhost:47371` for
data — so it "opens" offline but can't actually do anything.

**This app**: service worker (`public/sw.js`) precaches the shell + stale-while-revalidate for
navigation. Because the data layer is IndexedDB, the app **creates and prints a GST invoice
fully offline** after first load.

### 4. First-run setup wizard
**Upstream**: assumes Node launcher has already created the `data/` folder.

**This app**: `src/components/app/setup-wizard.tsx` runs on first launch — explains the
on-device storage model, collects the business profile (name/GSTIN/state/UPI), asks the user
to pick a folder (or OPFS) for backups, and optionally seeds sample clients & building-material
products (cement, gitti, balu, bricks, steel).

## Brand & theme changes (Step 3)

- Every themeable color replaced with Kumar Enterprises black `#0a0a0a`/`#111111` + gold
  `#F0A800` (sampled programmatically from the attached PNGs — see `README.md` brand table).
- The 9 "design presets" are re-tinted to gold-on-black variants (`src/lib/defaults.ts`,
  `DESIGN_PRESETS`).
- PWA `manifest.webmanifest` `theme_color` = `#F0A800`, `background_color` = `#0a0a0a`,
  `display` = `standalone`.
- App icon set (192/512/maskable/favicon) regenerated from the square monogram logo.
- Typography: **Barlow Condensed** (headings/brand, matching the logo wordmark) + **Inter**
  (body/tables).
- All user-facing strings renamed from "Free GST Billing Software" to "Kumar Enterprises Billing".

## Feature changes (Step 4)

### Added (not in upstream — built fresh for building-material context)
- **Non-GST Cash Memo** invoice type — for gitti (gravel) & balu (sand) sales that don't carry
  GST. Produces a clean printed receipt without misrepresenting the sale as a GST invoice.
- **Per-customer ledger view** (`client-ledger.tsx`) — groups all of one customer's invoices +
  payments on one screen with a running balance, debit/credit columns, and aging. Explicitly
  requested for customers like "Suresh" in the building-material trade.
- **Record Payment** dialog from the invoice preview + from the client ledger — updates invoice
  `paidAmount` / `balance` / `status` and writes a `Payment` record.
- **Stock auto-adjust** — issuing a Tax Invoice or Delivery Challan decrements product stock by
  the line quantity.

### Preserved (feature parity with upstream)
- 5 standard invoice types (Tax Invoice, Proforma, Bill of Supply, Credit Note, Delivery
  Challan) + the new Non-GST Cash Memo.
- CGST/SGST/IGST + UTGST auto-calc, HSN/SAC per line, custom units, UPI QR on invoice PDF,
  multi-currency, round-off, reverse charge.
- Client ledger, product catalog + stock, expense tracker, payment receipts with CRUD.
- P&L, outstanding/aging, low-stock, GSTR-1/3B reports.
- PDF download, WhatsApp/email share, CSV import for clients & products.
- Dark mode (re-tinted to gold on near-black).
- Ctrl+K command palette.

## Not yet ported (upstream "Coming Soon" / out of scope for this build)
- GSTR-2B reconciliation (input tax credit) — the GSTR-3B report shows output tax only; ITC is
  a placeholder. Add a purchases module to populate it.
- E-Way Bill JSON export.
- TDS/TCS Form 26Q/27EQ CSVs.
- Recurring invoices.
- Multi-language labels (UI is English; invoice text is English).
- Multi-business profiles (single business per install).

## Schema notes
The IndexedDB schema (`src/lib/db.ts`) stores: `invoices`, `clients`, `products`, `payments`,
`expenses`, `settings`, `meta`. The `BackupBundle` type (`src/lib/types.ts`) is the on-disk
format for folder/OPFS/download backups and is intentionally compatible with the upstream
`data/` folder's JSON shape, so a backup from this app can be dropped into a desktop build's
`data/` folder (and vice-versa) with minimal transformation.
