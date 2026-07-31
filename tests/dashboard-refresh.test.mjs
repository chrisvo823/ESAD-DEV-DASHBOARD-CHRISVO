import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("dashboard refresh interval is three minutes", async () => {
  const source = await readFile(
    new URL("../app/dashboard-refresh.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /export const DASHBOARD_REFRESH_INTERVAL_MS = 3 \* 60 \* 1000/,
  );
  assert.doesNotMatch(source, /=\s*1_000\b/);
  assert.doesNotMatch(source, /5 \* 60 \* 1000/);
  assert.doesNotMatch(source, /300_000/);
});

test("dashboard refresh client re-pulls Google Drive config and RSC card data", async () => {
  const source = await readFile(
    new URL("../app/dashboard-refresh.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /useRouter/);
  assert.match(source, /router\.refresh\(\)/);
  assert.match(source, /refreshSiteConfigFromHost/);
  assert.match(source, /setInterval/);
  assert.match(source, /DASHBOARD_REFRESH_INTERVAL_MS/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /inFlightRef/);
  assert.match(source, /Google Drive/);
  assert.match(source, /Smartsheet/);
  assert.match(source, /fetchAllProjectScheduleStats/);
});

test("home page force-dynamic re-fetches Smartsheet on router.refresh", async () => {
  const page = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  const smartsheet = await readFile(
    new URL("../lib/smartsheet.ts", import.meta.url),
    "utf8",
  );
  assert.match(page, /export const dynamic = "force-dynamic"/);
  assert.match(page, /fetchAllProjectScheduleStats/);
  assert.match(page, /DashboardRefresh/);
  assert.match(smartsheet, /cache:\s*"no-store"/);
});
