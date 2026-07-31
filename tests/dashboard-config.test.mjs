import assert from "node:assert/strict";
import test from "node:test";
import {
  DASHBOARD_CONFIGS,
  DASHBOARD_ID_BY_CODE,
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_USERNAME,
  formatCardNumberLabel,
  formatDashboardConfigText,
  getDashboardConfigForCode,
  normalizeCardNumber,
  parseAllDashboardConfigsFromText,
  parseDashboardConfigText,
  validateDashboardConfigSyntax,
} from "../lib/dashboard-config.ts";
import {
  AVIONICS_MASTER_SCHEDULE_PERMALINK,
  ESAD_PROJECT_INTEGRATIONS,
  googleSheetEditUrl,
} from "../lib/esad-projects.ts";

test("maps dashboard slots to board nicknames", () => {
  assert.equal(DASHBOARD_CONFIGS["1"].boardNickname, "DSB");
  assert.equal(DASHBOARD_CONFIGS["2"].boardNickname, "HVFB");
  assert.equal(DASHBOARD_CONFIGS["3"].boardNickname, "PRI");
  assert.equal(DASHBOARD_CONFIGS["4"].boardNickname, "IND");
  assert.equal(DASHBOARD_ID_BY_CODE.DSB, "1");
  assert.equal(DASHBOARD_ID_BY_CODE.HVFB, "2");
  assert.equal(DASHBOARD_ID_BY_CODE.PRI, "3");
  assert.equal(DASHBOARD_ID_BY_CODE.IND, "4");
});

test("formats DSB configuration text with Card # and Google Drive Link", () => {
  const text = formatDashboardConfigText(DASHBOARD_CONFIGS["1"]);
  const dsbSheetLink = googleSheetEditUrl(
    ESAD_PROJECT_INTEGRATIONS.DSB.googleSheetId,
  );
  assert.equal(
    text,
    [
      'Card #: "1"',
      'Responsible Engineer: "Bruno Abousleiman"',
      'Board Name: "Digital Safety Board"',
      'Board Nickname: "DSB"',
      `Google Drive Link: "${dsbSheetLink}"`,
      `Smartsheet Link: "${AVIONICS_MASTER_SCHEDULE_PERMALINK}"`,
    ].join("\n"),
  );
  assert.doesNotMatch(text, /Dash Board ID/);
  assert.doesNotMatch(text, /JIRA Epic Link/);
  assert.doesNotMatch(text, /^Green:/m);
  assert.doesNotMatch(text, /^Yellow:/m);
  assert.doesNotMatch(text, /^Red:/m);
  assert.match(DASHBOARD_CONFIGS["1"].googleDriveLink, /spreadsheets\/d\//);
});

test("parses Card # as the card id", () => {
  const edited = [
    'Card #: "2"',
    'Responsible Engineer: "Alex Rivera"',
    'Board Name: "Digital Safety Board Rev C"',
    'Board Nickname: "DSB-C"',
    'Google Drive Link: "https://drive.google.com/drive/folders/example"',
    'Smartsheet Link: "https://app.smartsheet.com/sheets/MQWP7M7WVcg7J7q5JFqvwV8mMpHVMx8w3wmXwMW1"',
  ].join("\n");

  const parsed = parseDashboardConfigText(edited, DASHBOARD_CONFIGS["1"]);
  assert.ok("config" in parsed);
  assert.equal(parsed.config.dashboardId, "2");
  assert.equal(parsed.config.responsibleEngineer, "Alex Rivera");
  assert.equal(parsed.config.boardName, "Digital Safety Board Rev C");
  assert.equal(parsed.config.boardNickname, "DSB-C");
  assert.equal(
    parsed.config.googleDriveLink,
    "https://drive.google.com/drive/folders/example",
  );
});

test("parses multiple Card # sections from one document", () => {
  const text = [
    'Card #: "1"',
    'Responsible Engineer: "One"',
    'Board Name: "Board One"',
    'Board Nickname: "B1"',
    'Google Drive Link: ""',
    'Smartsheet Link: ""',
    "",
    'Card #: "3"',
    'Responsible Engineer: "Three"',
    'Board Name: "Board Three"',
    'Board Nickname: "B3"',
    'Google Drive Link: ""',
    'Smartsheet Link: ""',
  ].join("\n");

  const parsed = parseAllDashboardConfigsFromText(text);
  assert.ok("configs" in parsed);
  assert.equal(parsed.configs.length, 2);
  assert.equal(parsed.configs[0]?.dashboardId, "1");
  assert.equal(parsed.configs[0]?.boardNickname, "B1");
  assert.equal(parsed.configs[1]?.dashboardId, "3");
  assert.equal(parsed.configs[1]?.boardNickname, "B3");
});

test("normalizes Card # labels", () => {
  assert.equal(normalizeCardNumber("1"), "1");
  assert.equal(normalizeCardNumber("Card #2"), "2");
  assert.equal(normalizeCardNumber("#3"), "3");
  assert.equal(formatCardNumberLabel("4"), "Card #4");
  assert.equal(normalizeCardNumber("x"), null);
});

test("rejects malformed configuration text", () => {
  const parsed = parseDashboardConfigText(
    'Board Name: "Only one field"',
    DASHBOARD_CONFIGS["1"],
  );
  assert.ok("error" in parsed);
});

test("accepts bare (unquoted) field values from Google Docs", () => {
  const text = [
    "Card #: 2",
    "Responsible Engineer: George Madden",
    "Board Name: High Voltage Filter Board",
    "Board Nickname: HVFB",
    "Google Drive Link:",
    "Smartsheet Link:",
  ].join("\n");

  const errors = validateDashboardConfigSyntax(text);
  assert.deepEqual(errors, []);

  const parsed = parseDashboardConfigText(text, DASHBOARD_CONFIGS["1"]);
  assert.ok("config" in parsed);
  assert.equal(parsed.config.dashboardId, "2");
  assert.equal(parsed.config.responsibleEngineer, "George Madden");
});

test("accepts Card #2 headings and smart quotes", () => {
  const text = [
    "Card #2",
    "Responsible Engineer: \u201CGeorge Madden\u201D",
    "Board Name: \u201CHigh Voltage Filter Board\u201D",
    "Board Nickname: HVFB",
    'Google Drive Link: ""',
    'Smartsheet Link: ""',
  ].join("\n");

  const parsed = parseAllDashboardConfigsFromText(text);
  assert.ok("configs" in parsed);
  assert.equal(parsed.configs.length, 1);
  assert.equal(parsed.configs[0]?.dashboardId, "2");
  assert.equal(parsed.configs[0]?.responsibleEngineer, "George Madden");
});

test("flags missing closing quote as a syntax error", () => {
  const text = [
    'Card #: "1"',
    'Responsible Engineer: "Bruno Abousleiman"',
    'Board Name: "Digital Safety Board',
    'Board Nickname: "DSB"',
    'Google Drive Link: ""',
    'Smartsheet Link: "https://app.smartsheet.com/sheets/MQWP7M7WVcg7J7q5JFqvwV8mMpHVMx8w3wmXwMW1"',
  ].join("\n");

  const errors = validateDashboardConfigSyntax(text);
  assert.ok(errors.some((error) => /missing a closing "/i.test(error)));
});

test("resolves dashboard config by project code", () => {
  assert.equal(getDashboardConfigForCode("DSB").dashboardId, "1");
  assert.equal(getDashboardConfigForCode("IND").boardName, "CPLD - Independent");
});

test("exposes default admin credentials", () => {
  assert.equal(DEFAULT_ADMIN_USERNAME, "admin");
  assert.equal(DEFAULT_ADMIN_PASSWORD, "esad");
});
