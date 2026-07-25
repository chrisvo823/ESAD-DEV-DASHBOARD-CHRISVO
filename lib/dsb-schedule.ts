import {
  ESAD_PROJECT_INTEGRATIONS,
  type EsadProjectCode,
} from "./esad-projects.ts";
import { getSmartsheetSheet } from "./smartsheet.ts";

export const AVIONICS_MASTER_SCHEDULE_SHEET_ID = 2069122061913988;
export const DSB_SCHEDULE_TASK_NAME =
  ESAD_PROJECT_INTEGRATIONS.DSB.smartsheetTaskName;

const COLUMN = {
  taskName: 5067326880960388,
  start: 7319126694645636,
  finish: 1689627160432516,
  percentComplete: 282252276879236,
  status: 4785851904249732,
  assignee: 3941426974117764,
} as const;

export type DsbScheduleTask = {
  id: number;
  name: string;
  start: string | null;
  finish: string | null;
  percentComplete: number | null;
  status: string | null;
  assignee: string | null;
  permalink: string;
};

export type DsbScheduleRevision = {
  id: number;
  name: string;
  start: string | null;
  finish: string | null;
  assignee: string | null;
  permalink: string;
  tasks: DsbScheduleTask[];
};

export type DsbScheduleStats = {
  taskName: string;
  href: string;
  revisionCount: number;
  revisions: DsbScheduleRevision[];
  currentTask: DsbScheduleTask | null;
  nextTask: DsbScheduleTask | null;
  overallProgressPercent: number;
  syncedAt: string | null;
};

type SmartsheetCell = {
  columnId: number;
  value?: unknown;
  displayValue?: string;
};

type SmartsheetRow = {
  id: number;
  parentId?: number;
  rowNumber?: number;
  permalink?: string;
  cells?: SmartsheetCell[];
};

function cellValue(row: SmartsheetRow, columnId: number): string | null {
  const cell = row.cells?.find((entry) => entry.columnId === columnId);
  if (!cell) return null;
  if (cell.displayValue != null && String(cell.displayValue).trim() !== "") {
    return String(cell.displayValue);
  }
  if (cell.value == null) return null;
  return String(cell.value);
}

function cellById(
  row: SmartsheetRow,
  columnId: number,
): SmartsheetCell | undefined {
  return row.cells?.find((entry) => entry.columnId === columnId);
}

/**
 * Smartsheet % Complete cells use displayValue like "72%" and raw value 0-1.
 * Blank cells return null (callers may treat that as 0% for display).
 */
export function parsePercentCompleteCell(
  cell: SmartsheetCell | undefined,
): number | null {
  if (!cell) return null;

  if (cell.displayValue != null && String(cell.displayValue).trim() !== "") {
    const fromDisplay = Number(String(cell.displayValue).replace("%", "").trim());
    if (Number.isFinite(fromDisplay)) {
      return Math.round(Math.max(0, Math.min(100, fromDisplay)) * 10) / 10;
    }
  }

  if (typeof cell.value === "number" && Number.isFinite(cell.value)) {
    const raw = cell.value;
    const asPercent = raw >= 0 && raw <= 1 ? raw * 100 : raw;
    return Math.round(Math.max(0, Math.min(100, asPercent)) * 10) / 10;
  }

  if (cell.value == null) return null;
  const fromValue = Number(String(cell.value).replace("%", "").trim());
  if (!Number.isFinite(fromValue)) return null;
  const asPercent = fromValue >= 0 && fromValue <= 1 ? fromValue * 100 : fromValue;
  return Math.round(Math.max(0, Math.min(100, asPercent)) * 10) / 10;
}

/** Format a schedule % Complete value for UI (e.g. 45 → "45%"). */
export function formatSchedulePercentComplete(
  percent: number | null | undefined,
): string | null {
  if (percent == null || !Number.isFinite(percent)) return null;
  const clamped = Math.max(0, Math.min(100, percent));
  const rounded = Math.round(clamped * 10) / 10;
  const label = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1);
  return `${label}%`;
}

/** Format Smartsheet Start/Finish date for card display (e.g. "Jul 2, 2026"). */
export function formatScheduleDate(
  value: string | null | undefined,
): string | null {
  if (!value || !String(value).trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const trimmed = String(value).trim();
    return trimmed || null;
  }
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

/** @deprecated Use formatScheduleDate. */
export function formatScheduleStartDate(
  value: string | null | undefined,
): string | null {
  return formatScheduleDate(value);
}

function formatSyncDate(value: string | null): string | null {
  return formatScheduleDate(value);
}

function progressFromDates(
  start: string | null,
  finish: string | null,
  now: Date,
): number {
  if (!start || !finish) return 0;
  const startMs = Date.parse(start);
  const finishMs = Date.parse(finish);
  if (!Number.isFinite(startMs) || !Number.isFinite(finishMs) || finishMs <= startMs) {
    return 0;
  }
  const ratio = (now.getTime() - startMs) / (finishMs - startMs);
  return Math.round(Math.max(0, Math.min(100, ratio * 1000))) / 10;
}

function rowPermalink(sheetPermalink: string, rowId: number, existing?: string) {
  if (existing) return existing;
  return `${sheetPermalink}?rowId=${rowId}`;
}

function toScheduleTask(
  row: SmartsheetRow,
  sheetPermalink: string,
): DsbScheduleTask {
  return {
    id: row.id,
    name: cellValue(row, COLUMN.taskName) ?? "Untitled task",
    start: cellValue(row, COLUMN.start),
    finish: cellValue(row, COLUMN.finish),
    percentComplete: parsePercentCompleteCell(
      cellById(row, COLUMN.percentComplete),
    ),
    status: cellValue(row, COLUMN.status),
    assignee: cellValue(row, COLUMN.assignee),
    permalink: rowPermalink(sheetPermalink, row.id, row.permalink),
  };
}

function isRevisionName(name: string | null): boolean {
  const normalized = (name ?? "").trim().toLowerCase();
  return normalized === "rev a" || normalized === "rev b";
}

/**
 * Build schedule stats for any ESAD board Task Name.
 * - Boards with Rev A / Rev B children (DSB, HVFB) use those revision groups.
 * - Boards with a flat task list (CPLD) treat direct children as schedule steps.
 */
export function buildScheduleStats(
  sheet: {
    permalink?: string;
    rows?: SmartsheetRow[];
  },
  taskName: string,
  now: Date = new Date(),
): DsbScheduleStats | null {
  const rows = sheet.rows ?? [];
  const sheetPermalink =
    sheet.permalink ??
    "https://app.smartsheet.com/sheets/MQWP7M7WVcg7J7q5JFqvwV8mMpHVMx8w3wmXwMW1";

  const childrenByParent = new Map<number, SmartsheetRow[]>();
  for (const row of rows) {
    if (row.parentId == null) continue;
    const list = childrenByParent.get(row.parentId) ?? [];
    list.push(row);
    childrenByParent.set(row.parentId, list);
  }

  const boardRow = rows.find(
    (row) => cellValue(row, COLUMN.taskName) === taskName,
  );
  if (!boardRow) return null;

  const directChildren = childrenByParent.get(boardRow.id) ?? [];
  const revisionRows = directChildren.filter((row) =>
    isRevisionName(cellValue(row, COLUMN.taskName)),
  );

  let revisions: DsbScheduleRevision[];

  if (revisionRows.length > 0) {
    revisions = revisionRows.map((revisionRow) => {
      const tasks = (childrenByParent.get(revisionRow.id) ?? []).map((taskRow) =>
        toScheduleTask(taskRow, sheetPermalink),
      );
      return {
        id: revisionRow.id,
        name: cellValue(revisionRow, COLUMN.taskName) ?? "Revision",
        start: cellValue(revisionRow, COLUMN.start),
        finish: cellValue(revisionRow, COLUMN.finish),
        assignee: cellValue(revisionRow, COLUMN.assignee),
        permalink: rowPermalink(
          sheetPermalink,
          revisionRow.id,
          revisionRow.permalink,
        ),
        tasks,
      };
    });
    // Keep Rev A before Rev B when both exist.
    revisions.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    // Flat schedule (e.g. CPLD): direct children are the Current/Next steps.
    revisions = [
      {
        id: boardRow.id,
        name: "Schedule",
        start: cellValue(boardRow, COLUMN.start),
        finish: cellValue(boardRow, COLUMN.finish),
        assignee: cellValue(boardRow, COLUMN.assignee),
        permalink: rowPermalink(sheetPermalink, boardRow.id, boardRow.permalink),
        tasks: directChildren.map((taskRow) =>
          toScheduleTask(taskRow, sheetPermalink),
        ),
      },
    ];
  }

  const boardStart = cellValue(boardRow, COLUMN.start);
  const boardFinish = cellValue(boardRow, COLUMN.finish);
  const currentTask = findCurrentScheduleTask(revisions, now);
  const nextTask = findNextScheduleTask(revisions, now);

  return {
    taskName,
    href: rowPermalink(sheetPermalink, boardRow.id, boardRow.permalink),
    revisionCount: revisions.length,
    revisions,
    currentTask,
    nextTask,
    overallProgressPercent: progressFromDates(boardStart, boardFinish, now),
    syncedAt: formatSyncDate(boardFinish),
  };
}

/** @deprecated Prefer buildScheduleStats(sheet, taskName, now) */
export function buildDsbScheduleStats(
  sheet: {
    permalink?: string;
    rows?: SmartsheetRow[];
  },
  now: Date = new Date(),
): DsbScheduleStats | null {
  return buildScheduleStats(sheet, DSB_SCHEDULE_TASK_NAME, now);
}

/** Business calendar for DSB schedule dates (Smartsheet wall times). */
export const DSB_SCHEDULE_TIME_ZONE =
  process.env.DSB_SCHEDULE_TIMEZONE?.trim() || "America/Los_Angeles";

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const map = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function zonedDayKey(ms: number, timeZone = DSB_SCHEDULE_TIME_ZONE): string {
  const parts = getZonedParts(new Date(ms), timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/** Convert a Smartsheet wall-time string into a UTC instant in the schedule timezone. */
function zonedWallTimeToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): number {
  // Guess UTC, then nudge until the zoned wall clock matches.
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = getZonedParts(new Date(utcMs), timeZone);
    const asUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const desired = Date.UTC(year, month - 1, day, hour, minute, second);
    const delta = desired - asUtc;
    if (delta === 0) break;
    utcMs += delta;
  }
  return utcMs;
}

function parseSmartsheetDate(
  value: string,
  timeZone = DSB_SCHEDULE_TIME_ZONE,
): number {
  const trimmed = value.trim();
  if (!trimmed) return Number.NaN;
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    return Date.parse(trimmed);
  }

  const match = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (!match) return Date.parse(trimmed);

  return zonedWallTimeToUtcMs(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4] ?? "0"),
    Number(match[5] ?? "0"),
    Number(match[6] ?? "0"),
    timeZone,
  );
}

function taskTimeBounds(task: Pick<DsbScheduleTask, "start" | "finish">): {
  startMs: number;
  finishMs: number;
} | null {
  if (!task.start || !task.finish) return null;
  const startMs = parseSmartsheetDate(task.start);
  const finishMs = parseSmartsheetDate(task.finish);
  if (!Number.isFinite(startMs) || !Number.isFinite(finishMs)) return null;
  return { startMs, finishMs };
}

/**
 * Pick the schedule task that covers today's calendar date in the schedule TZ.
 * Never selects a Smartsheet task whose start is still in the future.
 */
export function findCurrentScheduleTask(
  revisions: DsbScheduleRevision[],
  now: Date = new Date(),
): DsbScheduleTask | null {
  const nowMs = now.getTime();
  const todayKey = zonedDayKey(nowMs);
  const tasks = revisions.flatMap((revision) => revision.tasks);

  const todaysTasks = tasks
    .map((task) => {
      const bounds = taskTimeBounds(task);
      if (!bounds) return null;

      // Never treat a future-dated/future-timed Smartsheet row as current.
      if (bounds.startMs > nowMs) return null;

      const startKey = zonedDayKey(bounds.startMs);
      const finishKey = zonedDayKey(bounds.finishMs);
      if (startKey > todayKey || finishKey < todayKey) return null;

      return { task, startMs: bounds.startMs, finishMs: bounds.finishMs };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null);

  if (todaysTasks.length === 0) return null;

  todaysTasks.sort((a, b) => {
    // Prefer the latest-started task that still covers today.
    if (a.startMs !== b.startMs) return b.startMs - a.startMs;
    return a.finishMs - b.finishMs;
  });

  return todaysTasks[0]?.task ?? null;
}

export function findCurrentScheduleTaskId(
  revisions: DsbScheduleRevision[],
  now: Date = new Date(),
): number | null {
  return findCurrentScheduleTask(revisions, now)?.id ?? null;
}

/** Tasks in Smartsheet order: Rev A then Rev B, each in sheet row order. */
function sheetOrderedTasks(revisions: DsbScheduleRevision[]): DsbScheduleTask[] {
  return revisions.flatMap((revision) => revision.tasks);
}

/**
 * Next step in the Smartsheet schedule after today's current task.
 * Uses sheet order so the displayed Next Task matches the following row.
 */
export function findNextScheduleTask(
  revisions: DsbScheduleRevision[],
  now: Date = new Date(),
): DsbScheduleTask | null {
  const ordered = sheetOrderedTasks(revisions);
  if (ordered.length === 0) return null;

  const current = findCurrentScheduleTask(revisions, now);
  if (current) {
    const currentIndex = ordered.findIndex((task) => task.id === current.id);
    if (currentIndex < 0) return null;
    return ordered[currentIndex + 1] ?? null;
  }

  // No task covers today: next step is the first future-dated Smartsheet row.
  const nowMs = now.getTime();
  return (
    ordered.find((task) => {
      const bounds = taskTimeBounds(task);
      if (!bounds) return false;
      return bounds.startMs > nowMs;
    }) ?? null
  );
}

export function findNextScheduleTaskId(
  revisions: DsbScheduleRevision[],
  now: Date = new Date(),
): number | null {
  return findNextScheduleTask(revisions, now)?.id ?? null;
}

async function fetchAvionicsMasterScheduleSheet(
  token?: string,
): Promise<{ permalink?: string; rows?: SmartsheetRow[] } | null> {
  try {
    const columnIds = Object.values(COLUMN).join(",");
    const sheet = await getSmartsheetSheet(
      `${AVIONICS_MASTER_SCHEDULE_SHEET_ID}?columnIds=${columnIds}`,
      token,
    );
    return sheet as { permalink?: string; rows?: SmartsheetRow[] };
  } catch {
    return null;
  }
}

export async function fetchScheduleStats(
  taskName: string,
  token?: string,
  now: Date = new Date(),
): Promise<DsbScheduleStats | null> {
  const sheet = await fetchAvionicsMasterScheduleSheet(token);
  if (!sheet) return null;
  return buildScheduleStats(sheet, taskName, now);
}

export async function fetchDsbScheduleStats(
  token?: string,
  now: Date = new Date(),
): Promise<DsbScheduleStats | null> {
  return fetchScheduleStats(DSB_SCHEDULE_TASK_NAME, token, now);
}

/** Fetch Current/Next schedule stats for every ESAD board from one Smartsheet pull. */
export async function fetchAllProjectScheduleStats(
  token?: string,
  now: Date = new Date(),
): Promise<Partial<Record<EsadProjectCode, DsbScheduleStats>>> {
  const sheet = await fetchAvionicsMasterScheduleSheet(token);
  if (!sheet) return {};

  const result: Partial<Record<EsadProjectCode, DsbScheduleStats>> = {};
  for (const project of Object.values(ESAD_PROJECT_INTEGRATIONS)) {
    const stats = buildScheduleStats(sheet, project.smartsheetTaskName, now);
    if (stats) result[project.code] = stats;
  }
  return result;
}
