# AGENTS.md

## Cursor Cloud specific instructions

This repo is a single **vinext** app (Cloudflare Workers runtime + Next.js 16 / React 19),
rendering the static server-rendered ESAD development dashboard. Dashboard Name and
Program Lead come from host Dashboard Configuration (not compiled-in copy). There is no
external database or service to run: `.openai/hosting.json` sets `d1`/`r2` to `null`
and `db/schema.ts` is intentionally empty (D1/Drizzle are optional and unused).

Commands (defined in `package.json`, run from repo root):

- `npm run dev` — start the dev server on `http://localhost:3000/` (Vite + vinext, HMR enabled).
- `npm run lint` — ESLint.
- `npm test` — runs `npm run build` then Node's test runner against `tests/rendered-html.test.mjs`.
  Note: the test imports the built worker from `dist/server/index.js`, so it always builds first.
- `npm run build` — verify the vinext build output.

Cloud agent environment (`.cursor/environment.json`):

- `install` runs `npm install` on boot.
- A shared terminal starts `npm run dev` (dashboard at `http://localhost:3000/`).
- Optional secret: `SMARTSHEET_ACCESS_TOKEN` enables live Smartsheet schedule/tests; without it,
  those tests skip and the app still builds and runs.
- Firebase Auth (company Google sign-in + Drive login popup): set
  `NEXT_PUBLIC_FIREBASE_API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`, `APP_ID`
  (optional messaging/storage), **or** a single `FIREBASE_WEB_CONFIG` JSON.
  These are forwarded into the vinext worker and exposed via layout inject +
  `GET /api/firebase-web-config`. Without them the dashboard runs in preview mode.
- Optional secrets for shared Dashboard Configuration Google Doc + Admin Drive folder:
  `GOOGLE_SERVICE_ACCOUNT_JSON` (preferred) or `GOOGLE_DOCS_ACCESS_TOKEN`.
  Share the Doc **and** the Admin config Drive folder
  (`1g-pGEPe4f2sFmX0sngp-4Pm75ONGMnks`) with the service account (Viewer to
  list/load; Editor to save Dashboard Configuration). Without server credentials,
  Admin Load Config opens a Google Drive login popup (Firebase Google sign-in
  with Docs/Drive scopes); host cache / defaults are used for anonymous loads
  and Admin save fails.

Non-obvious caveats:

- `npm test` depends on the build output in `dist/`; run `npm run build` (or `npm test`) before
  expecting `dist/` to exist. Tests assert exact dashboard copy/metadata, so edits to
  `app/page.tsx` or `app/layout.tsx` may require updating `tests/rendered-html.test.mjs`.
- The dashboard is fully static content in `app/page.tsx` — there is no auth, form, or API to
  exercise; verify changes by loading `http://localhost:3000/` and inspecting the rendered HTML.
- Dual hosting: OpenAI Sites uses `vinext build` + Worker env bindings; Firebase App Hosting
  uses `NEXT_PRIVATE_STANDALONE=true` → `next build` → `.next/standalone/` and reads secrets
  from Cloud Run / `apphosting.yaml`. Site secrets do **not** carry over to Firebase.
  Without `SMARTSHEET_ACCESS_TOKEN` on the Firebase backend, Current/Next Task show
  **Unavailable**. Without Firebase web config (`FIREBASE_WEBAPP_CONFIG` at build or
  `NEXT_PUBLIC_FIREBASE_*`), Auth stays in preview mode.
- Host `.data/` is ephemeral on Workers / Cloud Run. Dashboard Configuration recovers via
  hardcoded `DASHBOARD_CONFIG_GOOGLE_DOC_ID`; Card Configuration recovers via shared
  `CARD_CONFIG_GOOGLE_DOC_ID` (`ESAD_Cards_Config`) when `cardConfigDocumentIds` is empty.
