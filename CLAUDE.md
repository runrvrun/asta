# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Asta** is a demo asset-management web app. It covers aircraft, helicopters, UAVs, radar, weapons, ground support equipment, vehicles, land, buildings and rotable components. It's built for sales demos to a military aviation customer. Two rules for all copy and sample data:
- Never name the customer service explicitly (no "angkatan udara").
- Keep every unit, person and registration number fictional.

UI text is Indonesian.

The app is Next.js (App Router, TypeScript) with `output: "export"`: a fully static site deployed on Vercel. **There is no backend or database.** All data lives in the browser's `localStorage`.

## Commands

```bash
npm run dev         # dev server, http://localhost:3000
npm run build       # static export to ./out (also type-checks)
npm start           # serve ./out locally
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
```

There are no tests. Demo logins use the password `asta123`. The accounts are `admin`, `komandan`, `petugas`, `teknisi` and `auditor`, one per role.

## Architecture

- **Data layer** (`lib/store.ts`): a single zustand store holds the whole `DB` object (`lib/types.ts`), persisted to localStorage under the key `asta-db`.
  - Change data only through `mutate(fn, audit?)`. It structured-clones the DB, applies `fn`, and appends an `AuditEntry` when `audit` is given.
  - `notify()` creates notifications that target a user or a role.
  - The store uses `skipHydration`. `StoreHydrator` in `app/layout.tsx` rehydrates it after mount, so pages must wait for `hydrated`. The `(app)` layout already does this.
- **Seed data** (`lib/seed.ts`): `createSeed()` builds the fictional dataset. Dates are relative to "now" so the demo always looks current.
  - Bumping `DB_VERSION` makes every browser discard its stored data and reseed. Do this whenever the `DB` shape changes.
  - Approval step templates live here: `disposalSteps()` and `transferSteps()`.
- **Business rules** (`lib/domain.ts`):
  - lookups (`userName`, `unitName`, …)
  - document numbering (`nextNo`, `nextAssetCode`)
  - straight-line depreciation
  - aviation inspection status
  - badge tone maps
  - approval helpers (`currentStep`, `pendingApprovalsFor`)
- **Roles and permissions** (`lib/permissions.ts`): the five roles are admin, pimpinan, petugas, teknisi and auditor.
  - Gate actions with `can(role, permission)`.
  - An approval step can be acted on by the role named in the step, and admin can act on any step (`canApproveStep`).
  - Navigation visibility is set in `lib/nav.ts`. Whole pages are gated with `components/RequireRole.tsx`.
- **Routing**: everything signed-in lives under `app/(app)/`. Its layout is the auth guard plus `AppShell`, which provides the sidebar, mobile drawer, bottom nav, notifications and user menu.
  - Static export can't do dynamic segments for records created at runtime. Detail pages therefore use query params (`/aset/detail?id=…`), read with `useSearchParams` inside `<Suspense>`.
  - Cross-module flows link by URL, e.g. `/pemeliharaan/baru?assetId=` or `/mutasi/baru?type=pinjam&assetId=`.
- **Side effects across modules**: these are part of the business logic, so keep them when you change a module.
  - Work orders switch an asset to "Dalam Pemeliharaan" and back.
  - Transfer handover moves an asset's unit and location. A loan sets the asset to "Dipinjam".
  - Disposal sets assets to "Diusulkan Hapus", then to "Dihapus" on approval or back to "Aktif" on rejection.
  - Flight logs add to the aircraft's hours and cycles.
  - Using a part deducts stock and records a `StockMovement`.
- **UI**: plain CSS in `app/globals.css`. It holds the design tokens (navy/blue palette from the original mockups) and the shared class vocabulary: `panel`, `table.table`, `list-card`, `kv-grid`, `badge <tone>`, `btn-*`, `stepper`, `stage-list`, `print-header`/`print-only`/`no-print`.
  - Shared React pieces live in `components/ui.tsx`, including `PageHeader`, `Modal`, `ConfirmDialog` and `toast`.
  - Icons live in `components/Icon.tsx`. Chart.js is registered in `components/charts.tsx`, and QR images are generated in `components/QRCode.tsx`.
  - Reports export CSV through `lib/export.ts` and print through `window.print()` with print CSS.
- `mockups/` holds the original static HTML mockups. They're design reference only, not part of the build.
