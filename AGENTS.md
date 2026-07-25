# AGENTS.md

## Cursor Cloud specific instructions

This repo is a single **vinext** app (Cloudflare Workers runtime + Next.js 16 / React 19),
rendering the static server-rendered "MACH ESAD Development Dashboard". There is no
external database or service to run: `.openai/hosting.json` sets `d1`/`r2` to `null`
and `db/schema.ts` is intentionally empty (D1/Drizzle are optional and unused).

Commands (defined in `package.json`, run from repo root):

- `npm run dev` — start the dev server on `http://localhost:3000/` (Vite + vinext, HMR enabled).
- `npm run lint` — ESLint.
- `npm test` — runs `npm run build` then Node's test runner against `tests/rendered-html.test.mjs`.
  Note: the test imports the built worker from `dist/server/index.js`, so it always builds first.
- `npm run build` — verify the vinext build output.

Non-obvious caveats:

- `npm test` depends on the build output in `dist/`; run `npm run build` (or `npm test`) before
  expecting `dist/` to exist. Tests assert exact dashboard copy/metadata, so edits to
  `app/page.tsx` or `app/layout.tsx` may require updating `tests/rendered-html.test.mjs`.
- The dashboard is fully static content in `app/page.tsx` — there is no auth, form, or API to
  exercise; verify changes by loading `http://localhost:3000/` and inspecting the rendered HTML.
