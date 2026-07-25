import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  DSB_SCHEDULE_TASK_NAME,
  buildDsbScheduleStats,
  buildScheduleStats,
  fetchDsbScheduleStats,
  findCurrentScheduleTaskId,
  findNextScheduleTask,
  formatScheduleDate,
  formatSchedulePercentComplete,
  parsePercentCompleteCell,
} from "../lib/dsb-schedule.ts";

const fixtureSheet = {
  permalink:
    "https://app.smartsheet.com/sheets/MQWP7M7WVcg7J7q5JFqvwV8mMpHVMx8w3wmXwMW1",
  rows: [
    {
      id: 1,
      cells: [{ columnId: 5067326880960388, value: "Other Program" }],
    },
    {
      id: 128284846915460,
      cells: [
        { columnId: 5067326880960388, value: "Digital Safety Board (DSB)" },
        { columnId: 7319126694645636, value: "2026-07-02T08:00:00" },
        { columnId: 1689627160432516, value: "2026-11-27T16:59:59" },
      ],
    },
    {
      id: 4631884474285956,
      parentId: 128284846915460,
      cells: [
        { columnId: 5067326880960388, value: "Rev A" },
        { columnId: 7319126694645636, value: "2026-07-02T08:00:00" },
        { columnId: 1689627160432516, value: "2026-09-29T16:59:59" },
        { columnId: 3941426974117764, displayValue: "George Madden" },
      ],
    },
    {
      id: 2380084660600708,
      parentId: 4631884474285956,
      cells: [
        { columnId: 5067326880960388, value: "Detail Architecture Work" },
        { columnId: 7319126694645636, value: "2026-07-02T08:00:00" },
        { columnId: 1689627160432516, value: "2026-07-16T16:59:59" },
        {
          columnId: 282252276879236,
          value: 0.45,
          displayValue: "45%",
        },
      ],
    },
    {
      id: 409759823626116,
      parentId: 128284846915460,
      cells: [
        { columnId: 5067326880960388, value: "Rev B" },
        { columnId: 7319126694645636, value: "2026-09-29T16:59:59" },
        { columnId: 1689627160432516, value: "2026-11-11T16:59:59" },
      ],
    },
    {
      id: 4913359450996612,
      parentId: 409759823626116,
      cells: [
        { columnId: 5067326880960388, value: "Requirements" },
        { columnId: 7319126694645636, value: "2026-09-29T16:59:59" },
        { columnId: 1689627160432516, value: "2026-09-29T16:59:59" },
      ],
    },
    {
      id: 6602209311260548,
      parentId: 128284846915460,
      cells: [{ columnId: 5067326880960388, value: "EMI/EMC on Iron-Bird" }],
    },
  ],
};

async function loadEnvToken() {
  if (process.env.SMARTSHEET_ACCESS_TOKEN?.trim()) {
    return process.env.SMARTSHEET_ACCESS_TOKEN.trim();
  }
  try {
    const envText = await readFile(new URL("../.env", import.meta.url), "utf8");
    const match = envText.match(/^\s*SMARTSHEET_ACCESS_TOKEN\s*=\s*(.+)\s*$/m);
    return match?.[1]?.trim() || null;
  } catch {
    return null;
  }
}

test("builds Rev A and Rev B schedule groups for Digital Safety Board task", () => {
  const stats = buildDsbScheduleStats(fixtureSheet, new Date("2026-07-23T12:00:00Z"));
  assert.ok(stats);
  assert.equal(stats.taskName, DSB_SCHEDULE_TASK_NAME);
  assert.equal(stats.revisionCount, 2);
  assert.deepEqual(
    stats.revisions.map((revision) => revision.name),
    ["Rev A", "Rev B"],
  );
  assert.equal(stats.revisions[0]?.tasks[0]?.name, "Detail Architecture Work");
  assert.equal(stats.revisions[1]?.tasks[0]?.name, "Requirements");
  assert.match(stats.href, /rowId=128284846915460/);
  assert.ok(stats.overallProgressPercent > 0);
});

test("highlights the in-window task as current work", () => {
  const stats = buildDsbScheduleStats(fixtureSheet, new Date("2026-07-10T12:00:00Z"));
  assert.ok(stats);
  assert.equal(
    findCurrentScheduleTaskId(stats.revisions, new Date("2026-07-10T12:00:00Z")),
    2380084660600708,
  );
  assert.equal(stats.currentTask?.id, 2380084660600708);
  assert.equal(stats.currentTask?.name, "Detail Architecture Work");
  assert.equal(stats.currentTask?.percentComplete, 45);
  assert.equal(stats.nextTask?.name, "Requirements");
  assert.equal(
    findNextScheduleTask(stats.revisions, new Date("2026-07-10T12:00:00Z"))?.name,
    "Requirements",
  );
});

test("parses Smartsheet % Complete display and fraction values", () => {
  assert.equal(
    parsePercentCompleteCell({ columnId: 1, displayValue: "72%", value: 0.72 }),
    72,
  );
  assert.equal(parsePercentCompleteCell({ columnId: 1, value: 0.455 }), 45.5);
  assert.equal(parsePercentCompleteCell({ columnId: 1, value: 1 }), 100);
  assert.equal(parsePercentCompleteCell({ columnId: 1 }), null);
  assert.equal(formatSchedulePercentComplete(45), "45%");
  assert.equal(formatSchedulePercentComplete(45.5), "45.5%");
  assert.equal(formatSchedulePercentComplete(null), null);
  assert.equal(formatScheduleDate("2026-07-02T08:00:00"), "Jul 2, 2026");
  assert.equal(formatScheduleDate("2026-07-16T16:59:59"), "Jul 16, 2026");
  assert.equal(formatScheduleDate(null), null);
  assert.equal(formatScheduleDate(""), null);
});

test("does not select a future Smartsheet task as current", () => {
  const stats = buildDsbScheduleStats(fixtureSheet, new Date("2026-08-01T12:00:00Z"));
  assert.ok(stats);
  assert.equal(
    findCurrentScheduleTaskId(stats.revisions, new Date("2026-08-01T12:00:00Z")),
    null,
  );
  assert.equal(stats.currentTask, null);
  assert.equal(stats.nextTask?.name, "Requirements");
});

test("keeps current task on today's calendar date even after finish time", () => {
  // 16:30 America/Los_Angeles on Jul 16 — after business hours but same local day.
  const stats = buildDsbScheduleStats(
    fixtureSheet,
    new Date("2026-07-16T23:30:00Z"),
  );
  assert.ok(stats);
  assert.equal(stats.currentTask?.name, "Detail Architecture Work");
  assert.equal(stats.nextTask?.name, "Requirements");
});

test("does not select a same-calendar-day task before its Smartsheet start time", () => {
  // Jul 24 00:02 UTC == Jul 23 17:02 America/Los_Angeles.
  // Schematic starts Jul 24 locally, so it must not become Current Task yet.
  const stats = buildDsbScheduleStats(
    fixtureSheet,
    new Date("2026-07-24T00:02:00Z"),
  );
  assert.ok(stats);
  assert.notEqual(stats.currentTask?.name, "Schematic");
  assert.notEqual(stats.currentTask?.name, "Block Diagram + Review");
});

const flatCpldFixture = {
  permalink:
    "https://app.smartsheet.com/sheets/MQWP7M7WVcg7J7q5JFqvwV8mMpHVMx8w3wmXwMW1",
  rows: [
    {
      id: 3398599580516228,
      cells: [
        { columnId: 5067326880960388, value: "CPLD - Primary" },
        { columnId: 7319126694645636, value: "2026-07-02T08:00:00" },
        { columnId: 1689627160432516, value: "2026-10-26T16:59:59" },
      ],
    },
    {
      id: 7902199207886724,
      parentId: 3398599580516228,
      cells: [
        { columnId: 5067326880960388, value: "Requirements" },
        { columnId: 7319126694645636, value: "2026-07-02T08:00:00" },
        { columnId: 1689627160432516, value: "2026-07-23T16:59:59" },
      ],
    },
    {
      id: 583849813409668,
      parentId: 3398599580516228,
      cells: [
        { columnId: 5067326880960388, value: "Block Diagram Review" },
        { columnId: 7319126694645636, value: "2026-07-24T08:00:00" },
        { columnId: 1689627160432516, value: "2026-08-10T16:59:59" },
      ],
    },
  ],
};

test("builds a flat schedule for CPLD boards without Rev A/B", () => {
  const stats = buildScheduleStats(
    flatCpldFixture,
    "CPLD - Primary",
    new Date("2026-07-10T12:00:00Z"),
  );
  assert.ok(stats);
  assert.equal(stats.taskName, "CPLD - Primary");
  assert.equal(stats.revisionCount, 1);
  assert.equal(stats.revisions[0]?.name, "Schedule");
  assert.equal(stats.currentTask?.name, "Requirements");
  assert.equal(stats.nextTask?.name, "Block Diagram Review");
  assert.match(stats.href, /rowId=3398599580516228/);
});

test("fetches live DSB schedule from Smartsheet when token is configured", async () => {
  const token = await loadEnvToken();
  if (!token) {
    console.log("skip: SMARTSHEET_ACCESS_TOKEN not configured");
    return;
  }

  // Jul 23 17:05 America/Los_Angeles — Design Analyses has started; Schematic has not.
  const stats = await fetchDsbScheduleStats(
    token,
    new Date("2026-07-24T00:05:00Z"),
  );
  assert.ok(stats, "expected live DSB schedule stats");
  assert.equal(stats.taskName, DSB_SCHEDULE_TASK_NAME);
  assert.equal(stats.revisionCount, 2);
  assert.deepEqual(
    stats.revisions.map((revision) => revision.name),
    ["Rev A", "Rev B"],
  );
  assert.ok(stats.revisions[0].tasks.length > 0);
  assert.ok(stats.revisions[1].tasks.length > 0);
  assert.equal(stats.currentTask?.name, "Design Analyses (SI/PI/Thermal/EMC)");
  assert.equal(stats.nextTask?.name, "Schematic");
  assert.notEqual(stats.currentTask?.id, stats.nextTask?.id);

  const sheetOrder = stats.revisions.flatMap((revision) => revision.tasks);
  const currentIndex = sheetOrder.findIndex(
    (task) => task.id === stats.currentTask?.id,
  );
  assert.equal(sheetOrder[currentIndex + 1]?.id, stats.nextTask?.id);
});
