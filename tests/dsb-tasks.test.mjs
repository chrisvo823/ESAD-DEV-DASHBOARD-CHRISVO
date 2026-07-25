import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateProgramTaskStats,
  countOpenTasksFromCsv,
  fetchDsbTaskStats,
  formatProgramPercent,
  jiraIssueUrl,
  statusFromOverdueCount,
} from "../lib/dsb-tasks.ts";

const sampleCsv = `Issue Type,Key,Summary,Status,Updated,Due date
Task,EE-1,Layout,TO DO,7/20/2026 13:59:36,7/20/2026
Task,EE-2,Requirements,Review,7/21/2026 09:00:00,7/22/2026
Task,EE-3,Bring up,In Progress,7/22/2026 10:15:00,7/23/2026
Task,EE-4,Ship,Done,7/23/2026 11:30:00,7/21/2026
Task,EE-5,Future work,TO DO,7/23/2026 12:00:00,8/10/2026
Task,EE-6,No due date,TO DO,7/23/2026 12:30:00,
`;

test("counts non-done DSB sheet rows as open tasks", () => {
  const stats = countOpenTasksFromCsv(sampleCsv, new Date(2026, 6, 23));
  assert.equal(stats.totalTasks, 6);
  assert.equal(stats.openTasks, 5);
  assert.equal(stats.doneTasks, 1);
  assert.equal(stats.completionPercent, 16.7);
  assert.equal(stats.syncedAt, "Jul 23, 2026");
  assert.deepEqual(
    stats.openItems.map((item) => item.key),
    ["EE-1", "EE-2", "EE-3", "EE-5", "EE-6"],
  );
});

test("maps overdue counts to indicator light status", () => {
  // Defaults: Green < 1, Yellow > 2, Red > 5
  assert.equal(statusFromOverdueCount(0), "On Track");
  assert.equal(statusFromOverdueCount(1), "Delayed");
  assert.equal(statusFromOverdueCount(2), "Delayed");
  assert.equal(statusFromOverdueCount(3), "Delayed");
  assert.equal(statusFromOverdueCount(5), "Delayed");
  assert.equal(statusFromOverdueCount(6), "At Risk");
  assert.equal(statusFromOverdueCount(12), "At Risk");
});

test("maps overdue counts with custom LED thresholds", () => {
  const thresholds = {
    greenLessThan: 2,
    yellowGreaterThan: 4,
    redGreaterThan: 8,
  };
  assert.equal(statusFromOverdueCount(0, thresholds), "On Track");
  assert.equal(statusFromOverdueCount(1, thresholds), "On Track");
  assert.equal(statusFromOverdueCount(2, thresholds), "Delayed");
  assert.equal(statusFromOverdueCount(5, thresholds), "Delayed");
  assert.equal(statusFromOverdueCount(9, thresholds), "At Risk");
});

test("aggregates Completed / Open / Overdue across all cards for Program Status", () => {
  const totals = aggregateProgramTaskStats([
    { doneTasks: 1, openTasks: 25, overdueTasks: 2 },
    { doneTasks: 1, openTasks: 25, overdueTasks: 0 },
    { doneTasks: 1, openTasks: 4, overdueTasks: 0 },
    { doneTasks: 1, openTasks: 4, overdueTasks: 0 },
  ]);
  assert.equal(totals.completedTasks, 4);
  assert.equal(totals.openTasks, 58);
  assert.equal(totals.overdueTasks, 2);
  assert.equal(totals.totalTasks, 62);
  assert.equal(
    Math.round(
      (totals.completedPercent +
        totals.openOnTimePercent +
        totals.overduePercent) *
        10,
    ) / 10,
    100,
  );
  assert.equal(totals.completedPercent, 6.5);
  assert.equal(totals.openPercent, 93.5);
  assert.equal(totals.openOnTimePercent, 90.3);
  assert.equal(totals.overduePercent, 3.2);
  assert.equal(formatProgramPercent(totals.completedPercent), "6.5%");
  assert.equal(formatProgramPercent(totals.openPercent), "93.5%");
  assert.equal(formatProgramPercent(totals.overduePercent), "3.2%");
  assert.equal(formatProgramPercent(60), "60%");
});

test("Program Status aggregation handles empty boards", () => {
  const totals = aggregateProgramTaskStats([]);
  assert.equal(totals.completedTasks, 0);
  assert.equal(totals.openTasks, 0);
  assert.equal(totals.overdueTasks, 0);
  assert.equal(totals.completedPercent, 0);
  assert.equal(totals.openPercent, 0);
});

test("counts overdue open tasks from Due date before today", () => {
  const stats = countOpenTasksFromCsv(sampleCsv, new Date(2026, 6, 23));
  // EE-1 (7/20) and EE-2 (7/22) are overdue; EE-3 is due today; EE-4 is done; EE-5 future; EE-6 blank.
  assert.equal(stats.overdueTasks, 2);
  assert.equal(stats.openTasksWithDueDate, 4);
  assert.equal(stats.overduePercent, 50);
  assert.deepEqual(
    stats.overdueItems.map((item) => item.key),
    ["EE-1", "EE-2"],
  );
});

test("includes key, summary, and assignee for overdue items", () => {
  // Column order matches the live sheet: A Issue Type, B Key, C Summary, D Labels, E Assignee...
  const csv = `Issue Type,Key,Summary,Labels,Assignee,Priority,Status,Updated,Due date
Task,EE-9,ESAD DIGITAL SAFETY BOARD - Requirements Locked,ESAD;ESAF,Bruno Abousleiman,Critical,TO DO,7/20/2026 13:59:36,7/20/2026
`;
  const stats = countOpenTasksFromCsv(csv, new Date(2026, 6, 23));
  assert.deepEqual(stats.overdueItems, [
    {
      key: "EE-9",
      summary: "ESAD DIGITAL SAFETY BOARD - Requirements Locked",
      assignee: "Bruno Abousleiman",
      dueDate: "Jul 20, 2026",
    },
  ]);
});

test("reads overdue summary from column C even if Summary header is renamed", () => {
  const csv = `Issue Type,Key,Title,Labels,Assignee,Priority,Status,Updated,Due date
Task,EE-10,Late board bring-up,BOARD;CRITICAL,Alex Rivera,Critical,TO DO,7/20/2026 13:59:36,7/20/2026
`;
  const stats = countOpenTasksFromCsv(csv, new Date(2026, 6, 23));
  assert.equal(stats.overdueItems[0]?.summary, "Late board bring-up");
});

test("does not count due-today or done tasks as overdue", () => {
  const stats = countOpenTasksFromCsv(sampleCsv, new Date(2026, 6, 20));
  // On 7/20, only dates before 7/20 count. None of the open dated tasks are before 7/20.
  assert.equal(stats.overdueTasks, 0);
});

test("builds Jira browse URLs from Column B keys", () => {
  assert.equal(
    jiraIssueUrl("EE-2226"),
    "https://mach.atlassian.net/browse/EE-2226",
  );
});

test("fetchDsbTaskStats reads open and overdue tasks from the live sheet", async () => {
  const stats = await fetchDsbTaskStats();
  assert.ok(stats, "expected live DSB sheet stats");
  assert.ok(stats.totalTasks > 0);
  assert.ok(stats.openTasks >= 0);
  assert.ok(stats.doneTasks >= 0);
  assert.equal(stats.openTasks + stats.doneTasks, stats.totalTasks);
  assert.equal(stats.openItems.length, stats.openTasks);
  assert.equal(stats.overdueItems.length, stats.overdueTasks);
  assert.ok(stats.overdueTasks >= 0);
  assert.ok(stats.overdueTasks <= stats.openTasksWithDueDate);
  assert.ok(stats.completionPercent >= 0);
  assert.ok(stats.completionPercent <= 100);
  assert.ok(stats.overduePercent >= 0);
  assert.ok(stats.overduePercent <= 100);
  assert.match(stats.syncedAt ?? "", /[A-Za-z]{3} \d{1,2}, \d{4}/);
  if (stats.openItems[0]) {
    assert.ok(stats.openItems[0].key);
    assert.ok("summary" in stats.openItems[0]);
    assert.ok("assignee" in stats.openItems[0]);
  }
});
