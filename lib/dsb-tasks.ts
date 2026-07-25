import {
  ESAD_PROJECT_INTEGRATIONS,
  googleSheetCsvUrl,
  googleSheetEditUrl,
} from "./esad-projects.ts";

export const DSB_SHEET_ID =
  ESAD_PROJECT_INTEGRATIONS.DSB.googleSheetId ??
  "1RbnLe7FBrnT1njFWnsVyW74Iq2N5miTH9vFmRwagzps";
export const DSB_SHEET_EDIT_URL = googleSheetEditUrl(DSB_SHEET_ID);
export const DSB_SHEET_CSV_URL = googleSheetCsvUrl(DSB_SHEET_ID);
export const DSB_JIRA_BROWSE_BASE_URL = "https://mach.atlassian.net/browse";

export function jiraIssueUrl(key: string): string {
  const trimmed = key.trim();
  return `${DSB_JIRA_BROWSE_BASE_URL}/${encodeURIComponent(trimmed)}`;
}

const DONE_STATUSES = new Set([
  "done",
  "closed",
  "resolved",
  "complete",
  "completed",
]);

/** Google Sheet column C (0-based index 2) — Summary. */
const SUMMARY_COLUMN_C_INDEX = 2;

export type DsbTaskItem = {
  key: string;
  summary: string;
  assignee: string;
  dueDate?: string;
};

/** @deprecated Use DsbTaskItem */
export type DsbOverdueItem = DsbTaskItem;

export type DsbTaskStats = {
  openTasks: number;
  doneTasks: number;
  totalTasks: number;
  /** Incomplete tasks whose Due date is before today. */
  overdueTasks: number;
  /** Open tasks that have a Due date set. */
  openTasksWithDueDate: number;
  /** Open rows with Key / Summary / Assignee for hover details. */
  openItems: DsbTaskItem[];
  /** Overdue rows with Key / Summary / Assignee for hover details. */
  overdueItems: DsbTaskItem[];
  /** Share of tasks in Done (0-100). Fill for the Open Tasks status bar. */
  completionPercent: number;
  /** Share of dated open tasks that are overdue (0-100). */
  overduePercent: number;
  syncedAt: string | null;
};

export type DsbIndicatorStatus = "On Track" | "Delayed" | "At Risk";

/** Per-card overdue thresholds that drive LED + status text. */
export type OverdueLedThresholds = {
  /** On Track when overdue count is &lt; this value. */
  greenLessThan: number;
  /** Delayed when overdue count is &gt; this value (and not red). */
  yellowGreaterThan: number;
  /** At Risk when overdue count is &gt; this value. */
  redGreaterThan: number;
};

export const DEFAULT_OVERDUE_LED_THRESHOLDS: OverdueLedThresholds = {
  greenLessThan: 1,
  yellowGreaterThan: 2,
  redGreaterThan: 5,
};

/**
 * Indicator lights from overdue count + configurable thresholds.
 * Precedence: Red (&gt; red) → Yellow (&gt; yellow) → Green (&lt; green) → Delayed.
 */
export function statusFromOverdueCount(
  overdueTasks: number,
  thresholds: OverdueLedThresholds = DEFAULT_OVERDUE_LED_THRESHOLDS,
): DsbIndicatorStatus {
  const overdue = Math.max(0, Number.isFinite(overdueTasks) ? overdueTasks : 0);
  if (overdue > thresholds.redGreaterThan) return "At Risk";
  if (overdue > thresholds.yellowGreaterThan) return "Delayed";
  if (overdue < thresholds.greenLessThan) return "On Track";
  return "Delayed";
}

/** Aggregated Program Status totals across every board card. */
export type ProgramTaskTotals = {
  completedTasks: number;
  openTasks: number;
  overdueTasks: number;
  /** completed + open */
  totalTasks: number;
  /** Completed / total (0-100). */
  completedPercent: number;
  /** Open / total (0-100), includes overdue. */
  openPercent: number;
  /** Exclusive donut slice: open and not overdue / total (0-100). */
  openOnTimePercent: number;
  /** Overdue / total (0-100). */
  overduePercent: number;
};

/** Format a 0-100 program metric for display, e.g. 6.5 → "6.5%". */
export function formatProgramPercent(value: number): string {
  const rounded = roundOneDecimal(Math.max(0, value));
  const text =
    Number.isInteger(rounded) || Math.abs(rounded - Math.round(rounded)) < 1e-9
      ? String(Math.round(rounded))
      : rounded.toFixed(1);
  return `${text}%`;
}

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Sum Completed / Open / Overdue across all cards for Program Status.
 * Donut percentages are mutually exclusive slices of (completed + open).
 */
export function aggregateProgramTaskStats(
  statsList: ReadonlyArray<{
    doneTasks: number;
    openTasks: number;
    overdueTasks: number;
  }>,
): ProgramTaskTotals {
  let completedTasks = 0;
  let openTasks = 0;
  let overdueTasks = 0;

  for (const stats of statsList) {
    completedTasks += Math.max(0, stats.doneTasks);
    openTasks += Math.max(0, stats.openTasks);
    overdueTasks += Math.max(0, stats.overdueTasks);
  }

  overdueTasks = Math.min(overdueTasks, openTasks);
  const openOnTimeTasks = Math.max(0, openTasks - overdueTasks);
  const totalTasks = completedTasks + openTasks;

  if (totalTasks === 0) {
    return {
      completedTasks,
      openTasks,
      overdueTasks,
      totalTasks,
      completedPercent: 0,
      openPercent: 0,
      openOnTimePercent: 0,
      overduePercent: 0,
    };
  }

  let completedPercent = roundOneDecimal((completedTasks / totalTasks) * 100);
  let openOnTimePercent = roundOneDecimal((openOnTimeTasks / totalTasks) * 100);
  let overduePercent = roundOneDecimal((overdueTasks / totalTasks) * 100);
  const drift = roundOneDecimal(
    100 - (completedPercent + openOnTimePercent + overduePercent),
  );
  if (drift !== 0) {
    // Absorb rounding drift into the largest slice.
    if (
      completedPercent >= openOnTimePercent &&
      completedPercent >= overduePercent
    ) {
      completedPercent = roundOneDecimal(completedPercent + drift);
    } else if (openOnTimePercent >= overduePercent) {
      openOnTimePercent = roundOneDecimal(openOnTimePercent + drift);
    } else {
      overduePercent = roundOneDecimal(overduePercent + drift);
    }
  }

  const openPercent = roundOneDecimal(openOnTimePercent + overduePercent);

  return {
    completedTasks,
    openTasks,
    overdueTasks,
    totalTasks,
    completedPercent,
    openPercent,
    openOnTimePercent,
    overduePercent,
  };
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((entry) => entry.some((value) => value.trim() !== ""));
}

function parseSheetDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const slashMatch = trimmed.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?$/,
  );
  if (slashMatch) {
    const [, month, day, year, hour = "0", minute = "0", second = "0"] =
      slashMatch;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const isoMatch = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (isoMatch) {
    const [, year, month, day, hour = "0", minute = "0", second = "0"] =
      isoMatch;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatSyncDate(date: Date): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function countOpenTasksFromCsv(
  csvText: string,
  now: Date = new Date(),
): DsbTaskStats {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) {
    return {
      openTasks: 0,
      doneTasks: 0,
      totalTasks: 0,
      overdueTasks: 0,
      openTasksWithDueDate: 0,
      openItems: [],
      overdueItems: [],
      completionPercent: 0,
      overduePercent: 0,
      syncedAt: null,
    };
  }

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const statusIndex = headers.indexOf("status");
  const updatedIndex = headers.indexOf("updated");
  const dueDateIndex = headers.indexOf("due date");
  const keyIndex = headers.indexOf("key");
  const assigneeIndex = headers.indexOf("assignee");
  // Prefer header match, but always fall back to Column C for Summary.
  const summaryHeaderIndex = headers.indexOf("summary");
  const summaryIndex =
    summaryHeaderIndex >= 0 ? summaryHeaderIndex : SUMMARY_COLUMN_C_INDEX;

  if (statusIndex < 0) {
    throw new Error("DSB sheet is missing a Status column");
  }

  let doneTasks = 0;
  let openTasksWithDueDate = 0;
  const openItems: DsbTaskItem[] = [];
  const overdueItems: DsbTaskItem[] = [];
  let latestUpdate: Date | null = null;
  const today = startOfLocalDay(now);

  for (const row of rows.slice(1)) {
    const status = (row[statusIndex] ?? "").trim().toLowerCase();
    const isDone = DONE_STATUSES.has(status);

    if (updatedIndex >= 0) {
      const updated = parseSheetDate(row[updatedIndex] ?? "");
      if (updated && (!latestUpdate || updated > latestUpdate)) {
        latestUpdate = updated;
      }
    }

    if (isDone) {
      doneTasks += 1;
      continue;
    }

    const summaryFromColumnC = (row[SUMMARY_COLUMN_C_INDEX] ?? "").trim();
    const item: DsbTaskItem = {
      key: (keyIndex >= 0 ? row[keyIndex] : "").trim() || "Unknown",
      summary:
        summaryFromColumnC ||
        (summaryIndex >= 0 ? row[summaryIndex] : "").trim(),
      assignee: (assigneeIndex >= 0 ? row[assigneeIndex] : "").trim(),
    };
    openItems.push(item);

    if (dueDateIndex >= 0) {
      const dueDate = parseSheetDate(row[dueDateIndex] ?? "");
      if (dueDate) {
        openTasksWithDueDate += 1;
        if (startOfLocalDay(dueDate) < today) {
          overdueItems.push({
            ...item,
            dueDate: formatSyncDate(dueDate),
          });
        }
      }
    }
  }

  const openTasks = openItems.length;
  const totalTasks = rows.length - 1;
  const overdueTasks = overdueItems.length;
  const completionPercent =
    totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 1000) / 10;
  const overduePercent =
    openTasksWithDueDate === 0
      ? 0
      : Math.round((overdueTasks / openTasksWithDueDate) * 1000) / 10;

  return {
    openTasks,
    doneTasks,
    totalTasks,
    overdueTasks,
    openTasksWithDueDate,
    openItems,
    overdueItems,
    completionPercent,
    overduePercent,
    syncedAt: latestUpdate ? formatSyncDate(latestUpdate) : null,
  };
}

export async function fetchProjectTaskStats(
  sheetId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DsbTaskStats | null> {
  try {
    const response = await fetchImpl(googleSheetCsvUrl(sheetId), {
      headers: {
        Accept: "text/csv,text/plain,*/*",
        "User-Agent": "mach-esad-dashboard/1.0",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const csvText = await response.text();
    if (!csvText.trim() || csvText.includes("<!DOCTYPE html>")) {
      return null;
    }

    return countOpenTasksFromCsv(csvText);
  } catch {
    return null;
  }
}

export async function fetchDsbTaskStats(
  fetchImpl: typeof fetch = fetch,
): Promise<DsbTaskStats | null> {
  return fetchProjectTaskStats(DSB_SHEET_ID, fetchImpl);
}

/** Fetch Google Sheet task stats for every configured ESAD board. */
export async function fetchAllProjectTaskStats(
  fetchImpl: typeof fetch = fetch,
): Promise<Partial<Record<"DSB" | "HVFB" | "PRI" | "IND", DsbTaskStats>>> {
  const entries = await Promise.all(
    (Object.values(ESAD_PROJECT_INTEGRATIONS) as Array<{
      code: "DSB" | "HVFB" | "PRI" | "IND";
      googleSheetId: string | null;
    }>).map(async (project) => {
      if (!project.googleSheetId) return [project.code, null] as const;
      const stats = await fetchProjectTaskStats(project.googleSheetId, fetchImpl);
      return [project.code, stats] as const;
    }),
  );

  const result: Partial<Record<"DSB" | "HVFB" | "PRI" | "IND", DsbTaskStats>> =
    {};
  for (const [code, stats] of entries) {
    if (stats) result[code] = stats;
  }
  return result;
}
