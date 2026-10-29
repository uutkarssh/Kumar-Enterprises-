# Kumar Enterprises Billing

A standalone **GST Billing PWA** for building-material & cement agencies — branded to Kumar Enterprises in black & gold.

This is a ground-up rebuild, re-themed and re-architected from the reference app
[IamRamgarhia/Free-GST-Billing-Software](https://github.com/IamRamgarhia/Free-GST-Billing-Software)
so that it runs **as a genuinely standalone, installable PWA on Android** — with no dependency on a
localhost Node server at runtime.

## What it is

- **6 invoice types**: Tax Invoice, Proforma, Bill of Supply, Credit Note, Delivery Challan,
  and a **Non-GST Cash Memo** for gitti (gravel) & balu (sand) cash sales that don't carry GST.
- **Full GST math**: CGST/SGST (intra-state), IGST (inter-state), UTGST for union territories,
  reverse-charge flag, HSN/SAC per line, 0/5/12/18/28% slabs, global discount, round-off.
- **Business management**: clients, per-customer ledger, inventory with stock tracking & low-stock
  alerts, expenses, payment receipts with CRUD.
- **Reports & compliance**: P&L, outstanding/aging, GSTR-1 B2B by rate, GSTR-3B summary, inventory
  valuation, tax-by-rate breakdown. PDF export for invoices + GSTR reports.
- **PWA**: installable on Android home screen, opens without browser chrome, works fully offline
  after first load, service worker precaches the app shell.

## Architecture — standalone PWA with folder-backed backup

The reference app is **Express + filesystem JSON** (`data/` folder of JSON files served over
`localhost:47371`). That model cannot be "installed" as a self-contained app on Android because
there is no always-on Node runtime on a phone — a PWA pointed at `localhost:47371` simply fails.

This rebuild moves the entire data layer into the browser:

| Layer | Upstream | This app |
|---|---|---|
| Live database | Express + `data/*.json` on disk | **IndexedDB** (browser) |
| Business logic | `src/store.js` → `fetch('/api/...')` | Same React components, calling a local data-access layer (`src/lib/db.ts`) |
| Offline shell | Service worker precaches app | Same — but **zero** dependency on `localhost:47371` |
| Backup | Copy the `data/` folder | **Folder-backed export** (File System Access API) with **OPFS** + downloadable `.json` fallback for Android |
| Desktop "Pro/LAN mode" | The only mode | (Pluggable — the storage layer is abstracted so a future desktop build can re-add the Express launcher for multi-PC LAN sync) |

### Storage priority (feature-detected at runtime)

1. **File System Access API** (`window.showDirectoryPicker()`) — Windows/macOS Chrome/Edge, and
   recent Android Chrome. Writes a single `kumar-billing-backup.json` straight to the chosen
   folder, mirroring the Node app's `data/` folder model.
2. **OPFS** (Origin Private File System) — Android & any browser without the Directory Picker.
   Saves to app-private storage **and** downloads a backup file the user can find in Downloads,
   so OPFS + the chosen folder never drift far apart.
3. **Manual download** — universal fallback. The user triggers backups from the Backup screen.

On first launch a setup wizard explains the model and asks the user to pick whichever picker is
supported on their device. The choice is stored in settings and never re-asked.

## Install paths

### Phone (default)
Open the live HTTPS preview URL on Android Chrome → browser menu → **Install app** / **Add to
Home screen**. The app installs as a standalone, offline-capable app — no Node server, no
localhost dependency.

### Desktop (optional Pro/LAN mode)
The standalone PWA works on desktop Chrome/Edge too. For shops that want multiple PCs sharing
one `data/` folder on a network drive, the storage layer is abstracted so a future desktop
launcher (`.hta` / `.command` / `.sh` + Express + real OS filesystem) can be re-added without
touching the React components.

## Tech stack

- **Next.js 16** (App Router) + **TypeScript 5**
- **Tailwind CSS 4** + **shadcn/ui** (New York)
- **IndexedDB** via `idb` — client-side live database
- **jsPDF** + **qrcode** — invoice PDFs with UPI QR
- **recharts** — dashboard & report charts
- **zustand** — client state

## Brand

Colors sampled programmatically from the attached Kumar Enterprises logos:

| Token | Value | Source |
|---|---|---|
| Ink / black | `#0a0a0a`–`#111111` | "K" + wordmark |
| Gold | `#F0A800` | Roof-peak fill + "ENTERPRISES" bar |
| Gold highlight | `#FFDA78` | Lightest amber pixels |
| Gold deep | `#966B04` | Pressed/border shadow |

Typography: **Barlow Condensed** (700–900, headings/brand, matching the logo's bold condensed
sans) + **Inter** (body/tables). Logo placement: square monogram as app icon / favicon /
maskable; wide lockup in sidebar header & invoice PDF masthead.

## Local development

```bash
bun install
bun run dev      # http://localhost:3000
bun run lint
```

Data lives in your browser's IndexedDB (DB name `ke-billing`). Use the **Backup & Restore**
screen to export/import a JSON bundle, or **Settings → About → Reset all data** to wipe.

## Project layout

```
src/
  app/                      Next.js App Router (layout.tsx, page.tsx)
  lib/
    types.ts                domain types + INDIAN_STATES, UNITS, INVOICE_TYPES
    db.ts                   IndexedDB data layer (idb) — replaces upstream's fetch('/api/...')
    gst.ts                  GST math: computeLine, computeInvoiceTotals, formatters, validators
    invoice-factory.ts      draft invoice + line-item factories
    pdf.ts                  jsPDF invoice + GSTR report generator
    storage.ts              folder/OPFS/manual backup + restore
    csv.ts                  CSV import/export
    defaults.ts             DEFAULT_SETTINGS, 9 design presets, seed clients & products
    store.ts                zustand app store + view router + theme
  components/
    ui/                     shadcn/ui component set
    app/                    sidebar, topbar, command palette, setup wizard
    views/                  dashboard, invoices, invoice-builder, invoice-preview,
                            clients, client-ledger, products, reports, settings, backup, trash
public/
  manifest.webmanifest      PWA manifest (theme #F0A800, standalone)
  sw.js                     service worker (precache + stale-while-revalidate)
  icon-192.png, icon-512.png, favicon.png
  icons/logo-wide.png, logo-square.png, logo-stacked.png
```
