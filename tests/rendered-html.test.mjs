import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the MACH ESAD dashboard", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>MACH ESAD Development Dashboard<\/title>/i);
  assert.match(
    html,
    /<meta(?=[^>]*\bname=["']description["'])(?=[^>]*\bcontent=["']Engineering project health, progress, and work tracking at a glance\.["'])[^>]*>/i,
  );
  assert.match(html, /Engineering Program Office/);
  assert.match(html, /Digital Safety Board/);
  assert.match(html, /High Voltage Fireset Board/);
  assert.match(html, /CPLD - Primary/);
  assert.match(html, /CPLD - Independent/);
  assert.match(html, /Health distribution/);
  assert.match(html, /Average board progress 72 percent/);
  assert.match(html, /SYNC <!-- -->JUL 21, 2026/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton|Codex/i);
});

test("keeps dashboard metadata and project data in source", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /const projects: Project\[\] = \[/);
  assert.match(page, /name: "Digital Safety Board"/);
  assert.match(page, /name: "High Voltage Fireset Board"/);
  assert.match(page, /name: "CPLD - Primary"/);
  assert.match(page, /name: "CPLD - Independent"/);
  assert.match(page, /function HealthCore\(\)/);
  assert.match(layout, /title: "MACH ESAD Development Dashboard"/);
  assert.match(layout, /og\.png/);
  assert.match(packageJson, /"name": "site-creator-vinext-starter"/);
  assert.doesNotMatch(page, /SkeletonPreview|react-loading-skeleton/);
  assert.doesNotMatch(layout, /codex-preview|_sites-preview|themeColor|\bViewport\b/);
});
