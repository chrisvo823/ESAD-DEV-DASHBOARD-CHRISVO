import assert from "node:assert/strict";
import test from "node:test";
import {
  createCustomCardRecord,
  createDefaultCustomCardConfig,
  isCustomCardId,
  nextSequentialCardId,
} from "../lib/custom-cards.ts";
import {
  formatDashboardConfigText,
  resetCardConfigQuotedValues,
} from "../lib/dashboard-config.ts";
import { formatCardConfigDocumentText } from "../lib/google-doc-card-config.ts";

test("assigns sequential Card # ids after the last numeric id", () => {
  assert.equal(nextSequentialCardId(["1", "2", "3", "4"]), "5");
  assert.equal(nextSequentialCardId(["1", "2", "3", "4", "5"]), "6");
  assert.equal(nextSequentialCardId(["4", "custom-old", "7"]), "8");
  const card = createCustomCardRecord(["1", "2", "3", "4"]);
  assert.equal(card.id, "5");
  assert.equal(card.config.dashboardId, "5");
  assert.equal(isCustomCardId(card.id), true);
  assert.equal(card.config.boardName, "New Board 5");
  assert.equal(card.config.boardNickname, "NB5");
});

test("formats new card defaults with quoted fields and quoted spaces for empties", () => {
  const config = createDefaultCustomCardConfig("5");
  assert.equal(
    formatDashboardConfigText(config, {
      quoted: true,
      emptyAsQuotedSpace: true,
    }),
    [
      'Card #: "5"',
      'Responsible Engineer: " "',
      'Board Name: "New Board 5"',
      'Board Nickname: "NB5"',
      'Google Drive Link: " "',
      'Smartsheet Link: " "',
    ].join("\n"),
  );
});

test("Card Configuration document text quotes new cards with spaced empties", () => {
  const text = formatCardConfigDocumentText([
    {
      dashboardId: "1",
      responsibleEngineer: "A",
      boardName: "Board",
      boardNickname: "B1",
      googleDriveLink: "",
      smartsheetLink: "",
    },
    createDefaultCustomCardConfig("5"),
  ]);
  assert.match(text, /Card #: "1"/);
  assert.match(text, /Responsible Engineer: "A"/);
  assert.match(text, /Card #: "5"/);
  assert.match(text, /Responsible Engineer: " "/);
  assert.match(text, /Board Name: "New Board 5"/);
  assert.match(text, /Board Nickname: "NB5"/);
  assert.match(text, /Google Drive Link: " "/);
  assert.match(text, /Smartsheet Link: " "/);
});

test("reset clears values inside quotes but keeps Card #", () => {
  const text = [
    'Card #: "5"',
    'Responsible Engineer: "George"',
    'Board Name: "New Board 5"',
    'Board Nickname: "NB5"',
    'Google Drive Link: "https://example.com"',
    'Smartsheet Link: "https://smartsheet.example"',
  ].join("\n");
  const reset = resetCardConfigQuotedValues(text);
  assert.equal(
    reset,
    [
      'Card #: "5"',
      'Responsible Engineer: ""',
      'Board Name: ""',
      'Board Nickname: ""',
      'Google Drive Link: ""',
      'Smartsheet Link: ""',
    ].join("\n"),
  );
});

test("rejects fixed and non-card ids as custom", () => {
  assert.equal(isCustomCardId("1"), false);
  assert.equal(isCustomCardId("DSB"), false);
  assert.equal(isCustomCardId("custom-legacy"), true);
  assert.equal(isCustomCardId("5"), true);
});
