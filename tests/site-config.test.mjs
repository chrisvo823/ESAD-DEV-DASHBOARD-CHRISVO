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

const DASHBOARD_CONFIG_GOOGLE_DOC_ID =
  "15XbbNYYGVMyxCgQs6MaQAO-cMLJTyRcF_67F0dmc-vA";

/** In-memory stand-in for Google Docs keyed by document id. */
const mockGoogleDocs = new Map([
  [
    DASHBOARD_CONFIG_GOOGLE_DOC_ID,
    formatProgramConfigText({
      dashboardName: "Engineering Dashboard",
      programLead: "Project Lead: ",
      openTasksLabel: "Open Tasks",
      overDueLabel: "Over Due",
      currentTaskLabel: "Current Task",
      nextTaskLabel: "Next Task",
      ledGreenAtMost: 1,
      ledYellowAtLeast: 3,
      ledRedAtLeast: 5,
    }),
  ],
]);

function readMockDoc(documentId) {
  return mockGoogleDocs.get(documentId) ?? "";
}

function writeMockDoc(documentId, text) {
  mockGoogleDocs.set(documentId, text);
}

function documentIdFromDocsUrl(url) {
  const match = url.match(/\/documents\/([^/:]+)/);
  return match ? decodeURIComponent(match[1]) : DASHBOARD_CONFIG_GOOGLE_DOC_ID;
}

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (url.includes("docs.googleapis.com/v1/documents/")) {
    const documentId = documentIdFromDocsUrl(url);
    if (url.includes(":batchUpdate") && init?.method === "POST") {
      const body = JSON.parse(String(init.body ?? "{}"));
      const inserted = body?.requests?.find((request) => request.insertText)
        ?.insertText?.text;
      if (typeof inserted === "string") writeMockDoc(documentId, inserted);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    const text = readMockDoc(documentId);
    const lines = text.split("\n");
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
    const match = url.match(/\/document\/d\/([^/]+)\//);
    const documentId = match
      ? decodeURIComponent(match[1])
      : DASHBOARD_CONFIG_GOOGLE_DOC_ID;
    return new Response(readMockDoc(documentId), { status: 200 });
  }
  return originalFetch(input, init);
};

const {
  applySiteConfigPatch,
  createDefaultSiteAdminConfig,
  resolveHostDashboardConfig,
  sanitizeCardConfigDocumentIds,
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
  assert.equal(pub.programConfig.dashboardName, "");
  assert.equal(pub.programConfig.programLead, "");
});

test("sanitizeProgramConfig keeps empty identity for Google Drive Dashboard Configuration", () => {
  const blank = sanitizeProgramConfig({
    dashboardName: "",
    programLead: "   ",
  });
  assert.equal(blank.dashboardName, "");
  assert.equal(blank.programLead, "");
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

test("sanitizeCardConfigDocumentIds keeps fixed and custom card mappings", () => {
  const sanitized = sanitizeCardConfigDocumentIds({
    "1": " doc-dsb ",
    "3": "doc-pri",
    weird: "nope",
    "custom-ok": "doc-custom",
    "2": "",
  });
  assert.deepEqual(sanitized, {
    "1": "doc-dsb",
    "3": "doc-pri",
    "custom-ok": "doc-custom",
  });
});

test("applySiteConfigPatch stores selected card Google Doc ids", () => {
  const base = createDefaultSiteAdminConfig();
  const next = applySiteConfigPatch(base, {
    cardConfigDocumentIds: { "3": "card-doc-pri" },
    dashboardConfig: {
      ...base.dashboardConfigs["3"],
      boardNickname: "CPLD",
    },
  });
  assert.equal(next.cardConfigDocumentIds["3"], "card-doc-pri");
  assert.equal(next.dashboardConfigs["3"]?.boardNickname, "CPLD");
  const publicConfig = toPublicSiteConfig(next);
  assert.equal(publicConfig.cardConfigDocumentIds["3"], "card-doc-pri");
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

  assert.match(readMockDoc(DASHBOARD_CONFIG_GOOGLE_DOC_ID), /Google Doc Dashboard/);
  assert.match(readMockDoc(DASHBOARD_CONFIG_GOOGLE_DOC_ID), /Google Doc Lead/);

  // Clear host cache + memory so load must come from the Google Doc.
  globalThis.__esadSiteAdminConfig__ = undefined;
  await rm(path.join(tempRoot, ".data"), { recursive: true, force: true });

  const loaded = await loadSiteAdminConfig();
  assert.equal(loaded.programConfig.dashboardName, "Google Doc Dashboard");
  assert.equal(loaded.programConfig.programLead, "Google Doc Lead");
  assert.equal(loaded.programConfig.openTasksLabel, "Open Work");
  assert.equal(loaded.programConfig.ledRedAtLeast, 6);
});

test("every Dashboard Configuration save writes and verifies the host file", async () => {
  const { getHostSiteConfigPath } = await import("../lib/site-config-store.ts");
  const hostPath = getHostSiteConfigPath();
  assert.equal(
    hostPath,
    path.join(tempRoot, ".data", "admin-site-config.json"),
  );

  const first = await updateSiteAdminConfig({
    programConfig: {
      dashboardName: "Save Writes Host File",
      programLead: "Save Lead",
      openTasksLabel: "Open Tasks",
      overDueLabel: "Over Due",
      currentTaskLabel: "Current Task",
      nextTaskLabel: "Next Task",
      ledGreenAtMost: 1,
      ledYellowAtLeast: 3,
      ledRedAtLeast: 5,
    },
  });
  const rawFirst = await readFile(hostPath, "utf8");
  const parsedFirst = JSON.parse(rawFirst);
  assert.equal(parsedFirst.programConfig.dashboardName, "Save Writes Host File");
  assert.equal(parsedFirst.programConfig.programLead, "Save Lead");
  assert.equal(parsedFirst.updatedAt, first.updatedAt);

  const second = await updateSiteAdminConfig({
    programConfig: {
      dashboardName: "Second Save Survives",
      programLead: "Second Lead",
      openTasksLabel: "Open Work",
      overDueLabel: "Past Due",
      currentTaskLabel: "Active Task",
      nextTaskLabel: "Upcoming Task",
      ledGreenAtMost: 2,
      ledYellowAtLeast: 4,
      ledRedAtLeast: 6,
    },
  });
  const rawSecond = await readFile(hostPath, "utf8");
  const parsedSecond = JSON.parse(rawSecond);
  assert.equal(parsedSecond.programConfig.dashboardName, "Second Save Survives");
  assert.equal(parsedSecond.programConfig.programLead, "Second Lead");
  assert.equal(parsedSecond.updatedAt, second.updatedAt);
  assert.match(rawSecond, /Second Save Survives/);
  assert.doesNotMatch(rawSecond, /Save Writes Host File/);

  // Card-only save must not wipe Dashboard Configuration identity.
  await updateSiteAdminConfig({
    dashboardConfig: {
      dashboardId: "1",
      responsibleEngineer: "Keep Identity",
      boardName: "Digital Safety Board",
      boardNickname: "DSB",
      googleDriveLink: "",
      smartsheetLink: "",
    },
  });
  const afterCard = JSON.parse(await readFile(hostPath, "utf8"));
  assert.equal(afterCard.programConfig.dashboardName, "Second Save Survives");
  assert.equal(afterCard.dashboardConfigs["1"]?.responsibleEngineer, "Keep Identity");
});

test("forceGoogleDocRefresh bypasses TTL so live Hero stays Doc-sourced", async () => {
  writeMockDoc(
    DASHBOARD_CONFIG_GOOGLE_DOC_ID,
    formatProgramConfigText({
      dashboardName: "Cached Doc Name",
      programLead: "Cached Lead",
      openTasksLabel: "Open Tasks",
      overDueLabel: "Over Due",
      currentTaskLabel: "Current Task",
      nextTaskLabel: "Next Task",
      ledGreenAtMost: 1,
      ledYellowAtLeast: 3,
      ledRedAtLeast: 5,
    }),
  );
  await loadSiteAdminConfig({ forceGoogleDocRefresh: true });

  writeMockDoc(
    DASHBOARD_CONFIG_GOOGLE_DOC_ID,
    formatProgramConfigText({
      dashboardName: "Fresh Doc Hero",
      programLead: "Fresh Doc Lead",
      openTasksLabel: "Open Tasks",
      overDueLabel: "Over Due",
      currentTaskLabel: "Current Task",
      nextTaskLabel: "Next Task",
      ledGreenAtMost: 1,
      ledYellowAtLeast: 3,
      ledRedAtLeast: 5,
    }),
  );

  const stale = await loadSiteAdminConfig();
  assert.equal(stale.programConfig.dashboardName, "Cached Doc Name");

  const fresh = await loadSiteAdminConfig({ forceGoogleDocRefresh: true });
  assert.equal(fresh.programConfig.dashboardName, "Fresh Doc Hero");
  assert.equal(fresh.programConfig.programLead, "Fresh Doc Lead");
});

test("Dashboard Configuration save publishes immediately to the bound Google Doc", async () => {
  const cardDocId = "dashboard-config-doc-bound";
  await updateSiteAdminConfig({
    programConfig: {
      dashboardName: "Bound Doc Dashboard",
      programLead: "Bound Lead",
      openTasksLabel: "Open Tasks",
      overDueLabel: "Over Due",
      currentTaskLabel: "Current Task",
      nextTaskLabel: "Next Task",
      ledGreenAtMost: 1,
      ledYellowAtLeast: 3,
      ledRedAtLeast: 5,
    },
    dashboardConfigDocumentId: cardDocId,
  });

  assert.match(readMockDoc(cardDocId), /Dashboard Name: "Bound Doc Dashboard"/);
  assert.match(readMockDoc(cardDocId), /Program Lead: "Bound Lead"/);
  const loaded = await loadSiteAdminConfig({ skipGoogleDoc: true });
  assert.equal(loaded.dashboardConfigDocumentId, cardDocId);
});

test("Card Configuration save publishes to the selected Google Doc for all users", async () => {
  const cardDocId = "card-config-doc-3";
  const base = createDefaultSiteAdminConfig().dashboardConfigs["3"];
  const published = {
    ...base,
    boardNickname: "CPLD",
    responsibleEngineer: "Doc Engineer",
  };

  await updateSiteAdminConfig({
    dashboardConfig: published,
    cardConfigDocumentIds: { "3": cardDocId },
    publishCardConfigToGoogleDoc: true,
  });

  assert.match(readMockDoc(cardDocId), /Board Nickname: "CPLD"/);
  assert.match(readMockDoc(cardDocId), /Responsible Engineer: "Doc Engineer"/);

  // Clear host cache so the next load must come from the selected card Doc.
  globalThis.__esadSiteAdminConfig__ = undefined;
  await rm(path.join(tempRoot, ".data"), { recursive: true, force: true });

  // Seed only the document id mapping on a fresh host file.
  await updateSiteAdminConfig(
    {
      cardConfigDocumentIds: { "3": cardDocId },
    },
    { skipGoogleDoc: true },
  );
  globalThis.__esadSiteAdminConfig__ = undefined;
  globalThis.__esadGoogleDocCardConfigCache__ = undefined;

  const loaded = await loadSiteAdminConfig({ forceGoogleDocRefresh: true });
  assert.equal(loaded.cardConfigDocumentIds["3"], cardDocId);
  assert.equal(loaded.dashboardConfigs["3"]?.boardNickname, "CPLD");
  assert.equal(loaded.dashboardConfigs["3"]?.responsibleEngineer, "Doc Engineer");
});

test("Card Configuration multi-card save writes every Card # section to one Google Doc", async () => {
  const cardDocId = "card-config-doc-all";
  const defaults = createDefaultSiteAdminConfig().dashboardConfigs;
  const configs = [
    {
      ...defaults["1"],
      responsibleEngineer: "Engineer One",
      boardNickname: "ONE",
    },
    {
      ...defaults["2"],
      responsibleEngineer: "George Madden",
      boardNickname: "HVFB",
    },
  ];

  await updateSiteAdminConfig({
    dashboardConfigs: {
      "1": configs[0],
      "2": configs[1],
    },
    cardConfigDocumentIds: { "1": cardDocId, "2": cardDocId },
    publishCardConfigToGoogleDoc: true,
    cardConfigsToPublish: configs,
  });

  const docText = readMockDoc(cardDocId);
  assert.match(docText, /Card #: "1"/);
  assert.match(docText, /Responsible Engineer: "Engineer One"/);
  assert.match(docText, /Card #: "2"/);
  assert.match(docText, /Responsible Engineer: "George Madden"/);
});
