import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { DASHBOARD_REFRESH_INTERVAL_MS } from "../app/dashboard-refresh.tsx";

test("dashboard refresh interval is five minutes", () => {
  assert.equal(DASHBOARD_REFRESH_INTERVAL_MS, 5 * 60 * 1000);
  assert.equal(DASHBOARD_REFRESH_INTERVAL_MS, 300_000);
});

test("dashboard refresh client re-pulls host config and RSC card data", async () => {
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
});
