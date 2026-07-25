import assert from "node:assert/strict";
import test from "node:test";
import {
  createCustomCardRecord,
  createDefaultCustomCardConfig,
  isCustomCardId,
} from "../lib/custom-cards.ts";
import { formatDashboardConfigText } from "../lib/dashboard-config.ts";

test("creates custom card ids with custom- prefix", () => {
  const card = createCustomCardRecord(1);
  assert.equal(isCustomCardId(card.id), true);
  assert.match(card.id, /^custom-/);
  assert.equal(card.config.dashboardId, card.id);
  assert.equal(card.config.boardName, "New Board 1");
  assert.equal(card.config.boardNickname, "NB1");
});

test("custom card config uses the same Configuration field format", () => {
  const config = createDefaultCustomCardConfig("custom-test", 2);
  assert.equal(
    formatDashboardConfigText(config),
    [
      'Responsible Engineer: ""',
      'Board Name: "New Board 2"',
      'Board Nickname: "NB2"',
      'Google Drive Link: ""',
      'Smartsheet Link: ""',
    ].join("\n"),
  );
});

test("rejects non-custom ids", () => {
  assert.equal(isCustomCardId("1"), false);
  assert.equal(isCustomCardId("DSB"), false);
});
