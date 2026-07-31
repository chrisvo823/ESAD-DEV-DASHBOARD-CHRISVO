import assert from "node:assert/strict";
import test from "node:test";
import {
  createCustomCardRecord,
  createDefaultCustomCardConfig,
  isCustomCardId,
  nextSequentialCardId,
} from "../lib/custom-cards.ts";
import { formatDashboardConfigText } from "../lib/dashboard-config.ts";
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

test("formats new card defaults without quotation marks", () => {
  const config = createDefaultCustomCardConfig("5");
  assert.equal(
    formatDashboardConfigText(config, { quoted: false }),
    [
      "Card #: 5",
      "Responsible Engineer: ",
      "Board Name: New Board 5",
      "Board Nickname: NB5",
      "Google Drive Link: ",
      "Smartsheet Link: ",
    ].join("\n"),
  );
});

test("Card Configuration document text keeps quotes for fixed cards only", () => {
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
  assert.match(text, /^Card #: 5$/m);
  assert.match(text, /^Responsible Engineer: $/m);
  assert.doesNotMatch(text, /Card #: "5"/);
});

test("rejects fixed and non-card ids as custom", () => {
  assert.equal(isCustomCardId("1"), false);
  assert.equal(isCustomCardId("DSB"), false);
  assert.equal(isCustomCardId("custom-legacy"), true);
  assert.equal(isCustomCardId("5"), true);
});
