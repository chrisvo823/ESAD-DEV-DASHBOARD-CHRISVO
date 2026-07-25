# AGENTS.md

## Cursor Cloud specific instructions

This repo is the **MACH ESAD Development Dashboard**: a **vinext** app (Cloudflare Workers
runtime + Vite) on Next.js 16 / React 19. There is no external database to run —
`.openai/hosting.json` sets `d1`/`r2` to `null` and `db/schema.ts` is intentionally empty
(D1/Drizzle are optional and unused). `npm install` is the only setup step.

### Run / dev

- `npm run dev:vinext` — canonical dev server on `http://localhost:3000/` (vinext + Vite, HMR).
 This is the runtime the build/test pipeline targets (Cloudflare Worker via `worker/index.ts`).
- `npm run dev` — `next dev` (plain Next.js). `next build`/`start` exist only for Firebase App
 Hosting's standalone adapter (`next.config.mjs` sets `output: "standalone"`); prefer the vinext
 commands for local work.
- `npm run build:vinext` — vinext build, emits the worker to `dist/`.
- `npm run lint` — ESLint.
- `npm test` — runs `npm run build:vinext` then `node --experimental-strip-types --test tests/*.test.mjs`.

### Auth gate — the dashboard UI is NOT reachable locally without secrets

The whole page is wrapped in a **client-side Firebase Google SSO gate** (`app/company-auth-gate.tsx`)
restricted to `@machindustries.com`. With no `NEXT_PUBLIC_FIREBASE_*` env set, the browser only ever
shows the "Firebase Auth is not configured" sign-in card — the dashboard, admin login
(default `admin`/`esad`), config windows, and theme picker all sit behind this gate. Seeing the real
dashboard requires valid `NEXT_PUBLIC_FIREBASE_*` config **and** a company Google account (external),
so plain local runs can only exercise the sign-in front door. Note the dashboard's server render
still executes on every request (its markup/data is present in the streamed RSC payload even while the
client gate hides it). Optional live data comes from env read by `vite.config.ts`: `SMARTSHEET_ACCESS_TOKEN`,
`ESAD_GOOGLE_SHEET_ID_{DSB,HVFB,PRI,IND}`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` (from `.env` or process env);
without them the dashboard falls back to hardcoded sample data.

### Known pre-existing failures (not caused by your changes)

- `npm test` is **not green at HEAD**. Unit tests that transitively import extensionless `.ts` modules
 (`custom-cards`, `dashboard-config`, `dsb-schedule`, `dsb-tasks`, `program-config`) fail with
 `ERR_MODULE_NOT_FOUND` — source files use extensionless relative imports (e.g. `./esad-projects`) that
 Vite/vinext resolves but Node's raw type-stripping test runner does not. This is a source/bundler mismatch,
 not a Node-version issue (reproduces on Node 22 and 24). `rendered-html.test.mjs` also fails because it
 expects the dashboard to server-render but the auth gate SSRs the sign-in screen. Tests that avoid the
 extensionless-import chain pass (`themes`, `smartsheet`, `admin-credentials`).
- `npm run lint` reports pre-existing errors (`react-hooks/set-state-in-effect` in `theme-picker.tsx`
 and `theme-store.ts`).

Do not "fix" these as part of unrelated work; treat them as the repo's current baseline.
