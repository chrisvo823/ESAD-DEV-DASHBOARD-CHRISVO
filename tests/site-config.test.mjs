import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { formatProgramConfigText } from "../lib/program-config.ts";

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "esad-site-config-"));
const previousCwd = process.cwd();
process.chdir(tempRoot);

process.env.GOOGLE_DOCS_ACCESS_TOKEN = "test-google-docs-token";

/** In-memory stand-in for the shared Dashboard Configuration Google Doc. */
let mockGoogleDocText = formatProgramConfigText({
  dashboardName: "Engineering Dashboard",
  programLead: "Project Lead: ",
  openTasksLabel: "Open Tasks",
  overDueLabel: "Over Due",
  currentTaskLabel: "Current Task",
  nextTaskLabel: "Next Task",
  ledGreenAtMost: 1,
  ledYellowAtLeast: 3,
  ledRedAtLeast: 5,
});

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (url.includes("docs.googleapis.com/v1/documents/")) {
    if (url.endsWith(":batchUpdate") && init?.method === "POST") {
      const body = JSON.parse(String(init.body ?? "{}"));
      const inserted = body?.requests?.find((request) => request.insertText)
        ?.insertText?.text;
      if (typeof inserted === "string") mockGoogleDocText = inserted;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    const lines = mockGoogleDocText.split("\n");
    return new Response(
      JSON.stringify({
        body: {
          content: [
            { endIndex: 1 },
            ...lines.map((line, index) => ({
              endIndex: index + 2,
              paragraph: {
                elements: [
                  {
                    textRun: {
                      content: `${line}\n`,
                    },
                  },
                ],
              },
            })),
          ],
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
  if (url.includes("docs.google.com/document/") && url.includes("export")) {
    return new Response(mockGoogleDocText, { status: 200 });
  }
  return originalFetch(input, init);
};

const {
  applySiteConfigPatch,
  createDefaultSiteAdminConfig,
  resolveHostDashboardConfig,
  sanitizeProgramConfig,
  sanitizeSiteAdminConfig,
  toPublicSiteConfig,
} = await import("../lib/site-config.ts");
const {
  changeHostAdminPassword,
  getPublicSiteConfig,
  loadSiteAdminConfig,
  resetHostAdminPassword,
  updateSiteAdminConfig,
  verifyAdminLogin,
} = await import("../lib/site-config-store.ts");

test.after(async () => {
  globalThis.fetch = originalFetch;
  delete process.env.GOOGLE_DOCS_ACCESS_TOKEN;
  process.chdir(previousCwd);
  await rm(tempRoot, { recursive: true, force: true });
});

test("public site config never exposes admin password", async () => {
  const config = createDefaultSiteAdminConfig();
  config.adminCredentials.password = "secret-host-password";
  const pub = toPublicSiteConfig(config);
  assert.equal("password" in pub, false);
  assert.equal(pub.recoveryEmail, "");
  assert.equal(pub.persisted, false);
  assert.equal(pub.programConfig.dashboardName, "Engineering Dashboard");
  assert.equal(pub.programConfig.programLead, "Project Lead: ");
});

test("sanitizeProgramConfig falls back to Engineering Dashboard defaults", () => {
  const blank = sanitizeProgramConfig({
    dashboardName: "",
    programLead: "   ",
  });
  assert.equal(blank.dashboardName, "Engineering Dashboard");
  assert.equal(blank.programLead, "Project Lead: ");
  const kept = sanitizeProgramConfig({
    dashboardName: "Custom Board Dashboard",
    programLead: "Project Lead: Ada ",
  });
  assert.equal(kept.dashboardName, "Custom Board Dashboard");
  assert.equal(kept.programLead, "Project Lead: Ada ");
});

test("host store persists program, dashboard, and custom card admin config", async () => {
  const updated = await updateSiteAdminConfig({
    programConfig: {
      dashboardName: "Host Dashboard",
      programLead: "Host Lead",
      ledGreenAtMost: 1,
      ledYellowAtLeast: 3,
      ledRedAtLeast: 5,
    },
    dashboardConfig: {
      dashboardId: "1",
      responsibleEngineer: "Ada",
      boardName: "Digital Safety Board",
      boardNickname: "DSB",
      googleDriveLink: "https://example.com/drive",
      smartsheetLink: "https://app.smartsheet.com/sheets/abc",
    },
    customCards: [
      {
        id: "custom-test-1",
        config: {
          dashboardId: "custom-test-1",
          responsibleEngineer: "Lin",
          boardName: "Extra Board",
          boardNickname: "XB",
          googleDriveLink: "",
          smartsheetLink: "",
        },
      },
    ],
  });

  assert.equal(updated.programConfig.dashboardName, "Host Dashboard");
  // Metric labels default when omitted from a host patch.
  assert.equal(updated.programConfig.openTasksLabel, "Open Tasks");
  assert.equal(updated.programConfig.currentTaskLabel, "Current Task");
  assert.equal(updated.dashboardConfigs["1"]?.responsibleEngineer, "Ada");
  assert.equal(updated.customCards[0]?.config.boardNickname, "XB");
  assert.ok(updated.updatedAt);

  const withLabels = await updateSiteAdminConfig({
    programConfig: {
      dashboardName: "Host Dashboard",
      programLead: "Host Lead",
      openTasksLabel: "Open Work",
      overDueLabel: "Past Due",
      currentTaskLabel: "Active Task",
      nextTaskLabel: "Upcoming Task",
      ledGreenAtMost: 1,
      ledYellowAtLeast: 3,
      ledRedAtLeast: 5,
    },
  });
  assert.equal(withLabels.programConfig.openTasksLabel, "Open Work");
  assert.equal(withLabels.programConfig.nextTaskLabel, "Upcoming Task");

  const pub = await getPublicSiteConfig();
  assert.equal(pub.persisted, true);
  assert.equal(pub.programConfig.dashboardName, "Host Dashboard");
  assert.equal(pub.customCards.length, 1);

  const raw = await readFile(
    path.join(tempRoot, ".data", "admin-site-config.json"),
    "utf8",
  );
  assert.match(raw, /Host Dashboard/);
  assert.match(raw, /custom-test-1/);
});

test("admin password change and reset are host-backed", async () => {
  assert.equal(await verifyAdminLogin("admin", "esad"), true);

  const changed = await changeHostAdminPassword({
    currentPassword: "esad",
    nextPassword: "hostpass",
  });
  assert.equal(changed.ok, true);
  assert.equal(await verifyAdminLogin("admin", "esad"), false);
  assert.equal(await verifyAdminLogin("admin", "hostpass"), true);

  const reset = await resetHostAdminPassword({
    email: "ops@mach.example",
    nextPassword: "resetpass",
  });
  assert.equal(reset.ok, true);
  assert.equal(await verifyAdminLogin("admin", "resetpass"), true);

  const mismatch = await resetHostAdminPassword({
    email: "other@mach.example",
    nextPassword: "nope",
  });
  assert.equal(mismatch.ok, false);

  const loaded = await loadSiteAdminConfig();
  assert.equal(loaded.adminCredentials.recoveryEmail, "ops@mach.example");
});

test("sanitize drops unknown custom ids and keeps fixed boards", () => {
  const sanitized = sanitizeSiteAdminConfig({
    dashboardConfigs: {
      "1": { responsibleEngineer: "A" },
      weird: { boardName: "Nope" },
      "custom-ok": {
        boardName: "Ok",
        boardNickname: "OK",
      },
    },
    customCards: [
      {
        id: "custom-ok",
        config: {
          dashboardId: "custom-ok",
          boardName: "Ok",
          boardNickname: "OK",
        },
      },
    ],
  });
  assert.equal(sanitized.dashboardConfigs.weird, undefined);
  assert.equal(sanitized.dashboardConfigs["1"]?.responsibleEngineer, "A");
  assert.equal(sanitized.dashboardConfigs["custom-ok"]?.boardName, "Ok");
});

test("applySiteConfigPatch updates nested admin fields", () => {
  const base = createDefaultSiteAdminConfig();
  const next = applySiteConfigPatch(base, {
    adminCredentials: { recoveryEmail: "lead@mach.example" },
  });
  assert.equal(next.adminCredentials.recoveryEmail, "lead@mach.example");
  assert.ok(next.updatedAt);
});

test("resolveHostDashboardConfig prefers host card configuration", () => {
  const fallback = createDefaultSiteAdminConfig().dashboardConfigs["1"];
  const host = {
    ...fallback,
    responsibleEngineer: "Host Engineer",
    boardNickname: "HOST",
  };
  const resolved = resolveHostDashboardConfig(
    "1",
    { "1": host },
    fallback,
  );
  assert.equal(resolved.responsibleEngineer, "Host Engineer");
  assert.equal(resolved.boardNickname, "HOST");
  assert.equal(
    resolveHostDashboardConfig("1", {}, fallback).boardNickname,
    fallback.boardNickname,
  );
});

test("loadSiteAdminConfig prefers host file over stale empty memory", async () => {
  await updateSiteAdminConfig({
    programConfig: {
      dashboardName: "Disk Survives Stale Memory",
      programLead: "Disk Lead",
      openTasksLabel: "Open Tasks",
      overDueLabel: "Over Due",
      currentTaskLabel: "Current Task",
      nextTaskLabel: "Next Task",
      ledGreenAtMost: 1,
      ledYellowAtLeast: 3,
      ledRedAtLeast: 5,
    },
  });

  // Poison memory with empty defaults (simulates another isolate / cold cache).
  globalThis.__esadSiteAdminConfig__ = createDefaultSiteAdminConfig();

  const loaded = await loadSiteAdminConfig();
  assert.equal(loaded.programConfig.dashboardName, "Disk Survives Stale Memory");
  assert.equal(loaded.programConfig.programLead, "Disk Lead");

  const raw = await readFile(
    path.join(tempRoot, ".data", "admin-site-config.json"),
    "utf8",
  );
  assert.match(raw, /Disk Survives Stale Memory/);
});

test("Dashboard Configuration saves to and loads from the shared Google Doc", async () => {
  await updateSiteAdminConfig({
    programConfig: {
      dashboardName: "Google Doc Dashboard",
      programLead: "Google Doc Lead",
      openTasksLabel: "Open Work",
      overDueLabel: "Past Due",
      currentTaskLabel: "Active Task",
      nextTaskLabel: "Upcoming Task",
      ledGreenAtMost: 2,
      ledYellowAtLeast: 4,
      ledRedAtLeast: 6,
    },
  });

  assert.match(mockGoogleDocText, /Google Doc Dashboard/);
  assert.match(mockGoogleDocText, /Google Doc Lead/);

  // Clear host cache + memory so load must come from the Google Doc.
  globalThis.__esadSiteAdminConfig__ = undefined;
  await rm(path.join(tempRoot, ".data"), { recursive: true, force: true });

  const loaded = await loadSiteAdminConfig();
  assert.equal(loaded.programConfig.dashboardName, "Google Doc Dashboard");
  assert.equal(loaded.programConfig.programLead, "Google Doc Lead");
  assert.equal(loaded.programConfig.openTasksLabel, "Open Work");
  assert.equal(loaded.programConfig.ledRedAtLeast, 6);
});

test("forceGoogleDocRefresh bypasses TTL so live Hero stays Doc-sourced", async () => {
  mockGoogleDocText = formatProgramConfigText({
    dashboardName: "Cached Doc Name",
    programLead: "Cached Lead",
    openTasksLabel: "Open Tasks",
    overDueLabel: "Over Due",
    currentTaskLabel: "Current Task",
    nextTaskLabel: "Next Task",
    ledGreenAtMost: 1,
    ledYellowAtLeast: 3,
    ledRedAtLeast: 5,
  });
  await loadSiteAdminConfig({ forceGoogleDocRefresh: true });

  mockGoogleDocText = formatProgramConfigText({
    dashboardName: "Fresh Doc Hero",
    programLead: "Fresh Doc Lead",
    openTasksLabel: "Open Tasks",
    overDueLabel: "Over Due",
    currentTaskLabel: "Current Task",
    nextTaskLabel: "Next Task",
    ledGreenAtMost: 1,
    ledYellowAtLeast: 3,
    ledRedAtLeast: 5,
  });

  const stale = await loadSiteAdminConfig();
  assert.equal(stale.programConfig.dashboardName, "Cached Doc Name");

  const fresh = await loadSiteAdminConfig({ forceGoogleDocRefresh: true });
  assert.equal(fresh.programConfig.dashboardName, "Fresh Doc Hero");
  assert.equal(fresh.programConfig.programLead, "Fresh Doc Lead");
});
