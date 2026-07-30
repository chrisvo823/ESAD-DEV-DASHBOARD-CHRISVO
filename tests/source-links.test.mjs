import assert from "node:assert/strict";
import test from "node:test";
import {
  AVIONICS_MASTER_SCHEDULE_PERMALINK,
  googleSheetEditUrl,
  ESAD_PROJECT_INTEGRATIONS,
} from "../lib/esad-projects.ts";
import {
  METRIC_SOURCE_EMPTY,
  METRIC_SOURCE_ERROR,
  METRIC_SOURCE_UNAVAILABLE,
  hrefMatchesSmartsheetConfig,
  parseGoogleSheetIdFromLink,
  parseSmartsheetPermalink,
  resolveGoogleDriveSource,
  resolveSmartsheetSheetIdFromLink,
  resolveSmartsheetSource,
  smartsheetHrefFromConfig,
} from "../lib/source-links.ts";
import {
  scheduleMetricsForSourceStatus,
  taskMetricsForSourceStatus,
  taskMetricsForUnavailableSheet,
} from "../lib/metric-source-state.ts";

test("parses Google Spreadsheet ids from Drive / Sheets links", () => {
  const sheetId = ESAD_PROJECT_INTEGRATIONS.DSB.googleSheetId;
  assert.equal(
    parseGoogleSheetIdFromLink(googleSheetEditUrl(sheetId)),
    sheetId,
  );
  assert.equal(
    parseGoogleSheetIdFromLink(
      `https://drive.google.com/file/d/${sheetId}/view`,
    ),
    sheetId,
  );
  assert.equal(
    parseGoogleSheetIdFromLink(`https://drive.google.com/open?id=${sheetId}`),
    sheetId,
  );
});

test("rejects blank and folder Google Drive links for task metrics", () => {
  assert.equal(resolveGoogleDriveSource("").status, "empty");
  assert.equal(resolveGoogleDriveSource("   ").status, "empty");
  assert.equal(
    resolveGoogleDriveSource(
      "https://drive.google.com/drive/folders/1rzUg72NQvjyvbNVi2Y7yH36uT6wiMylj",
    ).status,
    "invalid",
  );
  assert.equal(
    resolveGoogleDriveSource("https://example.com/not-a-sheet").status,
    "invalid",
  );
});

test("parses Smartsheet permalinks and resolves the Avionics sheet id", () => {
  assert.equal(
    parseSmartsheetPermalink(`${AVIONICS_MASTER_SCHEDULE_PERMALINK}?rowId=1`),
    AVIONICS_MASTER_SCHEDULE_PERMALINK,
  );
  assert.equal(
    resolveSmartsheetSheetIdFromLink(AVIONICS_MASTER_SCHEDULE_PERMALINK),
    2069122061913988,
  );
  assert.equal(resolveSmartsheetSource("").status, "empty");
  assert.equal(
    resolveSmartsheetSource(
      "https://app.smartsheet.com/sheets/UnknownPermalinkToken123",
    ).status,
    "ok",
  );
  assert.equal(
    resolveSmartsheetSheetIdFromLink(
      "https://app.smartsheet.com/sheets/UnknownPermalinkToken123",
    ),
    null,
  );
  assert.equal(
    resolveSmartsheetSource("https://example.com/sheets/x").status,
    "invalid",
  );
});

test("Configuration Smartsheet Link drives Current/Next Task hrefs", () => {
  assert.equal(
    smartsheetHrefFromConfig(AVIONICS_MASTER_SCHEDULE_PERMALINK),
    AVIONICS_MASTER_SCHEDULE_PERMALINK,
  );
  assert.equal(
    smartsheetHrefFromConfig(
      `${AVIONICS_MASTER_SCHEDULE_PERMALINK}?rowId=99`,
    ),
    AVIONICS_MASTER_SCHEDULE_PERMALINK,
  );
  assert.equal(smartsheetHrefFromConfig(""), null);
  assert.equal(
    hrefMatchesSmartsheetConfig(
      `${AVIONICS_MASTER_SCHEDULE_PERMALINK}?rowId=1`,
      AVIONICS_MASTER_SCHEDULE_PERMALINK,
    ),
    true,
  );
  assert.equal(
    hrefMatchesSmartsheetConfig(
      "https://app.smartsheet.com/sheets/OtherSheetToken",
      AVIONICS_MASTER_SCHEDULE_PERMALINK,
    ),
    false,
  );

  const linked = scheduleMetricsForSourceStatus(
    "ok",
    AVIONICS_MASTER_SCHEDULE_PERMALINK,
  );
  assert.equal(linked.current.valueText, "—");
  assert.equal(linked.current.href, AVIONICS_MASTER_SCHEDULE_PERMALINK);
  assert.equal(linked.current.valueHref, undefined);
  assert.equal(linked.next.href, AVIONICS_MASTER_SCHEDULE_PERMALINK);
});

test("builds Empty, Error, and Unavailable metric stubs", () => {
  const emptyTasks = taskMetricsForSourceStatus("empty");
  assert.equal(emptyTasks.open.valueText, METRIC_SOURCE_EMPTY);
  assert.equal(emptyTasks.overdue.valueText, METRIC_SOURCE_EMPTY);
  assert.equal(emptyTasks.open.hideValueBar, true);

  const errorSchedule = scheduleMetricsForSourceStatus("invalid");
  assert.equal(errorSchedule.current.valueText, METRIC_SOURCE_ERROR);
  assert.equal(errorSchedule.next.valueText, METRIC_SOURCE_ERROR);
  assert.equal(errorSchedule.current.href, undefined);

  const unavailable = taskMetricsForUnavailableSheet(
    "https://docs.google.com/spreadsheets/d/abc/edit",
  );
  assert.equal(unavailable.open.valueText, METRIC_SOURCE_UNAVAILABLE);
  assert.equal(unavailable.overdue.valueText, METRIC_SOURCE_UNAVAILABLE);
  assert.equal(
    unavailable.open.href,
    "https://docs.google.com/spreadsheets/d/abc/edit",
  );
});
