import assert from "node:assert/strict";
import test from "node:test";
import {
  DASHBOARD_CONFIG_GOOGLE_DOC_ID,
  DASHBOARD_CONFIG_GOOGLE_DOC_URL,
  DEFAULT_DASHBOARD_CONFIG_GOOGLE_DOC_ID,
  extractPlainTextFromGoogleDoc,
  parseDashboardConfigFromGoogleDocText,
  resolveDashboardConfigGoogleDocId,
} from "../lib/google-doc-dashboard-config.ts";
import { formatProgramConfigText } from "../lib/program-config.ts";

test("exposes the shared Dashboard Configuration Google Doc id and url", () => {
  assert.equal(
    DASHBOARD_CONFIG_GOOGLE_DOC_ID,
    "1V10HN9EQSx4a3CpJmb_aYyV_Xr37mo1zVXDhaTHEiB0",
  );
  assert.equal(
    DEFAULT_DASHBOARD_CONFIG_GOOGLE_DOC_ID,
    "1V10HN9EQSx4a3CpJmb_aYyV_Xr37mo1zVXDhaTHEiB0",
  );
  assert.equal(
    resolveDashboardConfigGoogleDocId(),
    DEFAULT_DASHBOARD_CONFIG_GOOGLE_DOC_ID,
  );
  assert.match(
    DASHBOARD_CONFIG_GOOGLE_DOC_URL,
    /1V10HN9EQSx4a3CpJmb_aYyV_Xr37mo1zVXDhaTHEiB0/,
  );
  assert.match(DASHBOARD_CONFIG_GOOGLE_DOC_URL, /tab=t\.0/);
});

test("parses Dashboard Configuration text from a Google Doc body", () => {
  const text = [
    'Dashboard Name: "Doc Driven Dashboard"',
    'Program Lead: "Doc Lead"',
    'Open Tasks: "Open Work"',
    'Over Due: "Past Due"',
    'Current Task: "Active Task"',
    'Next Task: "Upcoming Task"',
    "",
    "Card LED Threshold Configuration:",
    'Green: "2"',
    'Yellow: "4"',
    'Red: "6"',
    "",
  ].join("\n");

  const parsed = parseDashboardConfigFromGoogleDocText(text);
  assert.ok(parsed);
  assert.equal(parsed.dashboardName, "Doc Driven Dashboard");
  assert.equal(parsed.programLead, "Doc Lead");
  assert.equal(parsed.openTasksLabel, "Open Work");
  assert.equal(parsed.ledGreenAtMost, 2);
  assert.equal(parsed.ledYellowAtLeast, 4);
  assert.equal(parsed.ledRedAtLeast, 6);
});

test("round-trips formatProgramConfigText through Google Doc parsing", () => {
  const text = formatProgramConfigText({
    dashboardName: "Round Trip Dashboard",
    programLead: "Round Trip Lead",
    openTasksLabel: "Open Tasks",
    overDueLabel: "Over Due",
    currentTaskLabel: "Current Task",
    nextTaskLabel: "Next Task",
    ledGreenAtMost: 1,
    ledYellowAtLeast: 3,
    ledRedAtLeast: 5,
  });
  const parsed = parseDashboardConfigFromGoogleDocText(text);
  assert.equal(parsed?.dashboardName, "Round Trip Dashboard");
  assert.equal(parsed?.programLead, "Round Trip Lead");
});

test("extracts plain text from Google Docs API structural elements", () => {
  const text = extractPlainTextFromGoogleDoc({
    body: {
      content: [
        {
          endIndex: 20,
          paragraph: {
            elements: [{ textRun: { content: 'Dashboard Name: "From API"\n' } }],
          },
        },
        {
          endIndex: 40,
          paragraph: {
            elements: [{ textRun: { content: 'Program Lead: "API Lead"\n' } }],
          },
        },
      ],
    },
  });
  assert.match(text, /Dashboard Name: "From API"/);
  assert.match(text, /Program Lead: "API Lead"/);
});

test("exposes Card Configuration Google Doc read/write helpers", async () => {
  const { readFile } = await import("node:fs/promises");
  const [dashboardSource, cardSource] = await Promise.all([
    readFile(
      new URL("../lib/google-doc-dashboard-config.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../lib/google-doc-card-config.ts", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(dashboardSource, /export async function writePlainTextToGoogleDoc/);
  assert.match(dashboardSource, /export async function readGoogleDocPlainText/);
  assert.match(cardSource, /export async function readAllCardConfigsFromGoogleDoc/);
  assert.match(cardSource, /export async function writeCardConfigToGoogleDoc/);
  assert.match(cardSource, /formatCardConfigDocumentText/);
  assert.match(cardSource, /parseAllDashboardConfigsFromText/);
  assert.match(cardSource, /DEFAULT_CARD_CONFIG_GOOGLE_DOC_ID/);
  assert.match(cardSource, /1F016o0deQemL7Feo5QTZQl1VLgKOuiL5VQzwnM8JVj8/);
  assert.match(cardSource, /resolveCardConfigGoogleDocId/);
});
