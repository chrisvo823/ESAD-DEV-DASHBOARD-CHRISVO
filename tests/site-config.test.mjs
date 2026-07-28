import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "esad-site-config-"));
const previousCwd = process.cwd();
process.chdir(tempRoot);

const {
  applySiteConfigPatch,
  createDefaultSiteAdminConfig,
  resolveHostDashboardConfig,
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
  assert.equal(pub.programConfig.dashboardName, "");
  assert.equal(pub.programConfig.programLead, "");
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
  const fallback = createDefaultSiteAdminConfig().dashboardConfigs["1"]!;
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
