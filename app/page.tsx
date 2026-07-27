import { CompanyAuthGate } from "./company-auth-gate";
import { CustomCardsSection } from "./custom-cards-section";
import { DashboardRefresh } from "./dashboard-refresh";
import { HeroHeader } from "./hero-header";
import { ProjectPanel, type ProjectPanelProject } from "./project-panel";
import {
  DASHBOARD_CONFIGS,
  getAdminCredentials,
} from "../lib/dashboard-config";
import { loadSiteAdminConfig } from "../lib/site-config-store";
import {
  ESAD_PROJECT_INTEGRATIONS,
  googleSheetEditUrl,
  smartsheetRowUrl,
  type EsadProjectCode,
} from "../lib/esad-projects";
import {
  fetchAllProjectScheduleStats,
  findCurrentScheduleTask,
  findNextScheduleTask,
  formatScheduleDateRange,
  formatSchedulePercentComplete,
  type DsbScheduleRevision,
  type DsbScheduleStats,
} from "../lib/dsb-schedule";
import {
  aggregateProgramTaskStats,
  fetchAllProjectTaskStats,
  formatProgramPercent,
  statusFromOverdueCount,
  type DsbTaskStats,
  type ProgramTaskTotals,
} from "../lib/dsb-tasks";
import {
  scheduleMetricsForSourceStatus,
  taskMetricsForSourceStatus,
} from "../lib/metric-source-state";
import {
  resolveGoogleDriveSource,
  resolveSmartsheetSheetIdFromLink,
  resolveSmartsheetSource,
  smartsheetHrefFromConfig,
} from "../lib/source-links";

type Project = ProjectPanelProject;

function sheetEditUrlFor(code: EsadProjectCode): string {
  return googleSheetEditUrl(ESAD_PROJECT_INTEGRATIONS[code].googleSheetId);
}

export const dynamic = "force-dynamic";

function scheduleTask(
  id: number,
  name: string,
  start: string,
  finish: string,
): DsbScheduleRevision["tasks"][number] {
  return {
    id,
    name,
    start,
    finish,
    percentComplete: null,
    status: null,
    assignee: null,
    permalink: smartsheetRowUrl(id),
  };
}

const dsbScheduleFallbackRevisions: DsbScheduleRevision[] = [
  {
    id: 4631884474285956,
    name: "Rev A",
    start: "2026-07-02T08:00:00",
    finish: "2026-09-29T16:59:59",
    assignee: "George Madden",
    permalink: smartsheetRowUrl(4631884474285956),
    tasks: [
      scheduleTask(
        2380084660600708,
        "Detail Architecture Work",
        "2026-07-02T08:00:00",
        "2026-07-16T16:59:59",
      ),
      scheduleTask(
        6883684287971204,
        "Block Diagram + Review",
        // Smartsheet: Start 07/17/26, Finish 07/23/26
        "2026-07-17T08:00:00",
        "2026-07-23T16:59:59",
      ),
      // Keep offline Current/Next aligned with the live Avionics Master Schedule
      // sequence (Design Analyses → Schematic). Live Smartsheet replaces dates
      // when SMARTSHEET_ACCESS_TOKEN is set.
      scheduleTask(
        8145927045121924,
        "Design Analyses (SI/PI/Thermal/EMC)",
        "2026-07-23T08:00:00",
        "2026-08-06T16:59:59",
      ),
      scheduleTask(
        2594825670494084,
        "Schematic",
        "2026-08-07T08:00:00",
        "2026-08-20T16:59:59",
      ),
    ],
  },
  {
    id: 409759823626116,
    name: "Rev B",
    start: "2026-09-29T16:59:59",
    finish: "2026-11-11T16:59:59",
    assignee: null,
    permalink: smartsheetRowUrl(409759823626116),
    tasks: [
      scheduleTask(
        4913359450996612,
        "Requirements",
        "2026-09-29T16:59:59",
        "2026-09-29T16:59:59",
      ),
    ],
  },
];

const hvfbScheduleFallbackRevisions: DsbScheduleRevision[] = [
  {
    id: 4772621962641284,
    name: "Rev A",
    start: "2026-07-02T08:00:00",
    finish: "2026-09-29T16:59:59",
    assignee: null,
    permalink: smartsheetRowUrl(4772621962641284),
    tasks: [
      scheduleTask(
        2520822148956036,
        "Detail Architecture Work",
        "2026-07-02T08:00:00",
        "2026-07-16T16:59:59",
      ),
      scheduleTask(
        7024421776326532,
        "Block Diagram + Review",
        // Smartsheet: Start 07/17/26, Finish 07/23/26
        "2026-07-17T08:00:00",
        "2026-07-23T16:59:59",
      ),
      scheduleTask(
        8287038156232836,
        "Design Analyses (SI/PI/Thermal/EMC)",
        "2026-07-23T08:00:00",
        "2026-08-06T16:59:59",
      ),
      scheduleTask(
        2735936781604996,
        "Schematic",
        "2026-08-07T08:00:00",
        "2026-08-20T16:59:59",
      ),
    ],
  },
  {
    id: 550497311981444,
    name: "Rev B",
    start: "2026-09-29T16:59:59",
    finish: "2026-11-11T16:59:59",
    assignee: null,
    permalink: smartsheetRowUrl(550497311981444),
    tasks: [
      scheduleTask(
        5054096939351940,
        "Requirements",
        "2026-09-29T16:59:59",
        "2026-09-29T16:59:59",
      ),
    ],
  },
];

const cpldPrimaryScheduleFallbackRevisions: DsbScheduleRevision[] = [
  {
    id: 3398599580516228,
    name: "Schedule",
    start: "2026-07-02T08:00:00",
    finish: "2026-10-26T16:59:59",
    assignee: null,
    permalink: smartsheetRowUrl(3398599580516228),
    tasks: [
      scheduleTask(
        7902199207886724,
        "Requirements",
        "2026-07-02T08:00:00",
        "2026-07-23T16:59:59",
      ),
      scheduleTask(
        583849813409668,
        "Block Diagram Review",
        "2026-07-24T08:00:00",
        "2026-08-10T16:59:59",
      ),
      // Later CPLD steps — board row permalink until live Smartsheet supplies row ids.
      {
        id: 6401284739015556,
        name: "Design and Validation using SDK Platform",
        start: "2026-08-11T08:00:00",
        finish: "2026-08-14T16:59:59",
        percentComplete: null,
        status: null,
        assignee: null,
        permalink: smartsheetRowUrl(3398599580516228),
      },
      {
        id: 7512395840126668,
        name: "Verification on ESAD hardware",
        start: "2026-08-15T08:00:00",
        finish: "2026-09-25T16:59:59",
        percentComplete: null,
        status: null,
        assignee: null,
        permalink: smartsheetRowUrl(3398599580516228),
      },
      {
        id: 8623406951237772,
        name: "Validation on ESAD hardware",
        start: "2026-09-26T08:00:00",
        finish: "2026-10-26T16:59:59",
        percentComplete: null,
        status: null,
        assignee: null,
        permalink: smartsheetRowUrl(3398599580516228),
      },
    ],
  },
];

const cpldIndependentScheduleFallbackRevisions: DsbScheduleRevision[] = [
  {
    id: 221931156930436,
    name: "Schedule",
    start: "2026-07-02T08:00:00",
    finish: "2026-10-26T16:59:59",
    assignee: null,
    permalink: smartsheetRowUrl(221931156930436),
    tasks: [
      scheduleTask(
        4725530784300932,
        "Requirements",
        "2026-07-02T08:00:00",
        "2026-07-23T16:59:59",
      ),
      scheduleTask(
        2473730970615684,
        "Block Diagram Review",
        "2026-07-24T08:00:00",
        "2026-08-10T16:59:59",
      ),
      {
        id: 6401284739015557,
        name: "Design and Validation using SDK Platform",
        start: "2026-08-11T08:00:00",
        finish: "2026-08-14T16:59:59",
        percentComplete: null,
        status: null,
        assignee: null,
        permalink: smartsheetRowUrl(221931156930436),
      },
      {
        id: 7512395840126669,
        name: "Verification on ESAD",
        start: "2026-08-15T08:00:00",
        finish: "2026-09-25T16:59:59",
        percentComplete: null,
        status: null,
        assignee: null,
        permalink: smartsheetRowUrl(221931156930436),
      },
      {
        id: 8623406951237773,
        name: "Validation on ESAD",
        start: "2026-09-26T08:00:00",
        finish: "2026-10-26T16:59:59",
        percentComplete: null,
        status: null,
        assignee: null,
        permalink: smartsheetRowUrl(221931156930436),
      },
    ],
  },
];

const projects: Project[] = [
  {
    name: "Digital Safety Board",
    code: "DSB",
    config: DASHBOARD_CONFIGS["1"],
    // Fallback overdue count is 1 → On Track with default LED thresholds.
    status: "On Track",
    boards: [
      { name: "Main Carrier Board Rev B", progress: 70 },
      { name: "Main Carrier Board Rev C", progress: 50 },
      { name: "IO Board Rev B", progress: 75 },
      { name: "RF Carrier Board Rev B", progress: 77 },
      { name: "Nose Board Rev C", progress: 71 },
      { name: "Tail Board Rev A", progress: 90 },
    ],
    metrics: [
      {
        value: 25,
        label: "Open Tasks",
        href: sheetEditUrlFor("DSB"),
        barPercent: 100,
        barLabel: "25 open tasks with due dates",
        detailItems: [
          {
            key: "EE-2221",
            summary: "ESAD DIGITAL SAFETY BOARD - Layout & Release Checklist Complete",
            assignee: "",
          },
        ],
      },
      {
        value: 1,
        label: "Over Due",
        href: sheetEditUrlFor("DSB"),
        barPercent: 4,
        barLabel: "1 of 25 open tasks overdue",
        detailItems: [
          {
            key: "EE-2226",
            summary: "ESAD DIGITAL SAFETY BOARD - Requirements Locked",
            assignee: "Bruno Abousleiman",
            dueDate: "Jul 20, 2026",
          },
        ],
      },
      {
        value: 0,
        label: "Current Task",
        href: smartsheetRowUrl(128284846915460),
        valueText: "Design Analyses (SI/PI/Thermal/EMC)",
        valueDateLabel:
          formatScheduleDateRange(
            "2026-07-23T08:00:00",
            "2026-08-06T16:59:59",
          ) ?? undefined,
        valueHref: smartsheetRowUrl(8145927045121924),
        focusTaskId: 8145927045121924,
        hideValueBar: true,
        scheduleRevisions: dsbScheduleFallbackRevisions,
      },
      {
        value: 0,
        label: "Next Task",
        href: smartsheetRowUrl(2594825670494084),
        valueText: "Schematic",
        valueDateLabel:
          formatScheduleDateRange(
            "2026-08-07T08:00:00",
            "2026-08-20T16:59:59",
          ) ?? undefined,
        valueHref: smartsheetRowUrl(2594825670494084),
        focusTaskId: 2594825670494084,
        hideValueBar: true,
        scheduleRevisions: dsbScheduleFallbackRevisions,
      },
    ],
    // Fallback when the sheet cannot be fetched: 1 done / 25 open.
    taskProgressPercent: 3.8,
    taskProgressCaption: "3.8% done · 1 done / 25 open",
    updated: "Jul 15, 2026",
  },
  {
    name: "High Voltage Fireset Board",
    code: "HVFB",
    config: DASHBOARD_CONFIGS["2"],
    // Fallback overdue count is 5 → At Risk with default LED thresholds.
    status: "At Risk",
    boards: [
      { name: "IO Board Rev A", progress: 100 },
      { name: "GSE Board Rev A", progress: 92 },
      { name: "Servo Board Rev A", progress: 85 },
      { name: "Pyro Board Rev A", progress: 68 },
      { name: "3 Phase PDB Board Rev A", progress: 32 },
      { name: "Array Launcher Rev A", progress: 50 },
    ],
    metrics: [
      {
        value: 41,
        label: "Open Tasks",
        href: sheetEditUrlFor("HVFB"),
        barPercent: 0,
        barLabel: "Open tasks from Google Sheet when configured",
        detailItems: [],
      },
      {
        value: 5,
        label: "Over Due",
        href: sheetEditUrlFor("HVFB"),
        barPercent: 0,
        barLabel: "Overdue tasks from Google Sheet when configured",
        detailItems: [],
      },
      {
        value: 0,
        label: "Current Task",
        href: smartsheetRowUrl(269022335270788),
        valueText: "Design Analyses (SI/PI/Thermal/EMC)",
        valueDateLabel:
          formatScheduleDateRange(
            "2026-07-23T08:00:00",
            "2026-08-06T16:59:59",
          ) ?? undefined,
        valueHref: smartsheetRowUrl(8287038156232836),
        focusTaskId: 8287038156232836,
        hideValueBar: true,
        scheduleRevisions: hvfbScheduleFallbackRevisions,
      },
      {
        value: 0,
        label: "Next Task",
        href: smartsheetRowUrl(2735936781604996),
        valueText: "Schematic",
        valueDateLabel:
          formatScheduleDateRange(
            "2026-08-07T08:00:00",
            "2026-08-20T16:59:59",
          ) ?? undefined,
        valueHref: smartsheetRowUrl(2735936781604996),
        focusTaskId: 2735936781604996,
        hideValueBar: true,
        scheduleRevisions: hvfbScheduleFallbackRevisions,
      },
    ],
    updated: "Jul 21, 2026",
  },
  {
    name: "CPLD - Primary",
    code: "PRI",
    config: DASHBOARD_CONFIGS["3"],
    // Fallback overdue count is 0 → On Track.
    status: "On Track",
    boards: [{ name: "Servo Board", progress: 5 }],
    metrics: [
      {
        value: 21,
        label: "Open Tasks",
        href: sheetEditUrlFor("PRI"),
        barPercent: 0,
        barLabel: "Open tasks from Google Sheet when configured",
        detailItems: [],
      },
      {
        value: 0,
        label: "Over Due",
        href: sheetEditUrlFor("PRI"),
        barPercent: 0,
        barLabel: "Overdue tasks from Google Sheet when configured",
        detailItems: [],
      },
      {
        value: 0,
        label: "Current Task",
        href: smartsheetRowUrl(3398599580516228),
        valueText: "Block Diagram Review",
        valueDateLabel:
          formatScheduleDateRange(
            "2026-07-24T08:00:00",
            "2026-08-10T16:59:59",
          ) ?? undefined,
        valueHref: smartsheetRowUrl(583849813409668),
        focusTaskId: 583849813409668,
        hideValueBar: true,
        scheduleRevisions: cpldPrimaryScheduleFallbackRevisions,
      },
      {
        value: 0,
        label: "Next Task",
        href: smartsheetRowUrl(3398599580516228),
        valueText: "Design and Validation using SDK Platform",
        valueDateLabel:
          formatScheduleDateRange(
            "2026-08-11T08:00:00",
            "2026-08-14T16:59:59",
          ) ?? undefined,
        valueHref: smartsheetRowUrl(3398599580516228),
        focusTaskId: 6401284739015556,
        hideValueBar: true,
        scheduleRevisions: cpldPrimaryScheduleFallbackRevisions,
      },
    ],
    updated: "Jun 23, 2026",
  },
  {
    name: "CPLD - Independent",
    code: "IND",
    config: DASHBOARD_CONFIGS["4"],
    // Fallback overdue count is 1 → On Track with default LED thresholds.
    status: "On Track",
    boards: [
      { name: "Carrier Board Rev A", progress: 50 },
      { name: "Autofill Board Rev A", progress: 73 },
      { name: "LED Board Rev A", progress: 45 },
      { name: "Bulkhead Board Rev A", progress: 50 },
      { name: "BMS Rev A", progress: 41 },
      { name: "BMS Connector Rev A", progress: 41 },
    ],
    metrics: [
      {
        value: 66,
        label: "Open Tasks",
        href: sheetEditUrlFor("IND"),
        barPercent: 0,
        barLabel: "Open tasks from Google Sheet when configured",
        detailItems: [],
      },
      {
        value: 1,
        label: "Over Due",
        href: sheetEditUrlFor("IND"),
        barPercent: 0,
        barLabel: "Overdue tasks from Google Sheet when configured",
        detailItems: [],
      },
      {
        value: 0,
        label: "Current Task",
        href: smartsheetRowUrl(221931156930436),
        valueText: "Block Diagram Review",
        valueDateLabel:
          formatScheduleDateRange(
            "2026-07-24T08:00:00",
            "2026-08-10T16:59:59",
          ) ?? undefined,
        valueHref: smartsheetRowUrl(2473730970615684),
        focusTaskId: 2473730970615684,
        hideValueBar: true,
        scheduleRevisions: cpldIndependentScheduleFallbackRevisions,
      },
      {
        value: 0,
        label: "Next Task",
        href: smartsheetRowUrl(221931156930436),
        valueText: "Design and Validation using SDK Platform",
        valueDateLabel:
          formatScheduleDateRange(
            "2026-08-11T08:00:00",
            "2026-08-14T16:59:59",
          ) ?? undefined,
        valueHref: smartsheetRowUrl(221931156930436),
        focusTaskId: 6401284739015557,
        hideValueBar: true,
        scheduleRevisions: cpldIndependentScheduleFallbackRevisions,
      },
    ],
    updated: "Jul 21, 2026",
  },
];

function doneTasksFromProject(project: Project): number {
  const openMetric = project.metrics.find((metric) => metric.label === "Open Tasks");
  const fromBar = openMetric?.barLabel?.match(/^(\d+)\s+of\s+\d+\s+tasks\s+done$/i);
  if (fromBar) return Number(fromBar[1]);
  const fromCaption = project.taskProgressCaption?.match(
    /(\d+)\s+done\s*\/\s*(\d+)\s+open/i,
  );
  if (fromCaption) return Number(fromCaption[1]);
  return 0;
}

function programStatusFromProjects(projectList: Project[]): ProgramTaskTotals {
  return aggregateProgramTaskStats(
    projectList.map((project) => {
      const openTasks =
        project.metrics.find((metric) => metric.label === "Open Tasks")?.value ??
        0;
      const overdueTasks =
        project.metrics.find((metric) => metric.label === "Over Due")?.value ??
        0;
      return {
        doneTasks: doneTasksFromProject(project),
        openTasks,
        overdueTasks,
      };
    }),
  );
}

function HealthCore({ status }: { status: ProgramTaskTotals }) {
  const openOnTimeEnd = status.completedPercent + status.openOnTimePercent;
  const donutBackground =
    status.totalTasks === 0
      ? "conic-gradient(#1e3a52 0 100%)"
      : `conic-gradient(var(--green) 0 ${status.completedPercent}%, var(--amber) ${status.completedPercent}% ${openOnTimeEnd}%, var(--red) ${openOnTimeEnd}% 100%)`;
  const completedLabel = formatProgramPercent(status.completedPercent);
  const openLabel = formatProgramPercent(status.openPercent);
  const overdueLabel = formatProgramPercent(status.overduePercent);

  return (
    <aside
      className="health-core"
      aria-label={`Program status: ${completedLabel} completed tasks, ${openLabel} open tasks, ${overdueLabel} overdue tasks`}
    >
      <div className="orbit orbit--outer" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="orbit orbit--inner" aria-hidden="true" />
      <div className="health-donut" style={{ background: donutBackground }}>
        <div className="health-center">
          <h2>Program<br />status</h2>
          <div className="health-stat health-stat--green">
            <i />
            <span>Completed Tasks</span>
            <strong>{completedLabel}</strong>
          </div>
          <div className="health-stat health-stat--amber">
            <i />
            <span>Open Tasks</span>
            <strong>{openLabel}</strong>
          </div>
          <div className="health-stat health-stat--red">
            <i />
            <span>Overdue Tasks</span>
            <strong>{overdueLabel}</strong>
          </div>
        </div>
      </div>
    </aside>
  );
}

function isEsadProjectCode(code: string): code is EsadProjectCode {
  return code === "DSB" || code === "HVFB" || code === "PRI" || code === "IND";
}

type ScheduleMetricProject = Project["metrics"][number];

function isSchedulePlaceholder(valueText: string | undefined): boolean {
  return !valueText || valueText === "—";
}

/** Map live or fallback schedule stats onto Current Task / Next Task metrics. */
function metricsWithScheduleStats(
  metrics: ScheduleMetricProject[],
  schedule: {
    href: string;
    currentTask: DsbScheduleStats["currentTask"];
    nextTask: DsbScheduleStats["nextTask"];
    revisions: DsbScheduleRevision[];
  },
  /** Configuration Smartsheet Link — used for Current/Next Task label hrefs. */
  smartsheetConfigHref: string,
): ScheduleMetricProject[] {
  return metrics.map((metric) => {
    if (metric.label === "Current Task") {
      const current = schedule.currentTask;
      // Blank Smartsheet % Complete cells read as 0% for in-progress work.
      const percentLabel = current
        ? formatSchedulePercentComplete(current.percentComplete ?? 0)
        : undefined;
      const valueText = current?.name ?? "—";
      return {
        ...metric,
        value: 0,
        href: smartsheetConfigHref,
        valueText,
        valueDateLabel:
          formatScheduleDateRange(current?.start, current?.finish) ?? undefined,
        valueHref: isSchedulePlaceholder(valueText)
          ? undefined
          : (current?.permalink ?? smartsheetConfigHref),
        valuePercentLabel: percentLabel ?? undefined,
        focusTaskId: current?.id,
        hideValueBar: true,
        barPercent: undefined,
        barLabel: undefined,
        scheduleRevisions: schedule.revisions,
      };
    }

    if (metric.label === "Next Task") {
      const next = schedule.nextTask;
      const valueText = next?.name ?? "—";
      return {
        ...metric,
        value: 0,
        href: smartsheetConfigHref,
        valueText,
        valueDateLabel:
          formatScheduleDateRange(next?.start, next?.finish) ?? undefined,
        valueHref: isSchedulePlaceholder(valueText)
          ? undefined
          : (next?.permalink ?? smartsheetConfigHref),
        focusTaskId: next?.id,
        hideValueBar: true,
        barPercent: undefined,
        barLabel: undefined,
        scheduleRevisions: schedule.revisions,
      };
    }

    return metric;
  });
}

/**
 * When Smartsheet cannot be fetched, derive Current/Next from the static
 * fallback revisions already embedded on each card so row links stay intact.
 */
function fallbackScheduleFromMetrics(metrics: ScheduleMetricProject[]): {
  href: string;
  currentTask: DsbScheduleStats["currentTask"];
  nextTask: DsbScheduleStats["nextTask"];
  revisions: DsbScheduleRevision[];
} {
  const currentMetric = metrics.find((metric) => metric.label === "Current Task");
  const revisions = currentMetric?.scheduleRevisions ?? [];

  return {
    href: currentMetric?.href ?? DASHBOARD_CONFIGS["1"].smartsheetLink,
    currentTask: findCurrentScheduleTask(revisions),
    nextTask: findNextScheduleTask(revisions),
    revisions,
  };
}

function applyLiveProjectStats(
  projectList: Project[],
  taskStatsByCode: Partial<Record<EsadProjectCode, DsbTaskStats>>,
  scheduleStatsByCode: Partial<Record<EsadProjectCode, DsbScheduleStats>>,
): Project[] {
  return projectList.map((project) => {
    const code = isEsadProjectCode(project.code) ? project.code : null;
    const stats = code ? (taskStatsByCode[code] ?? null) : null;
    const scheduleStats = code ? (scheduleStatsByCode[code] ?? null) : null;
    const driveSource = resolveGoogleDriveSource(project.config.googleDriveLink);
    const smartsheetSource = resolveSmartsheetSource(
      project.config.smartsheetLink,
    );
    const smartsheetConfigHref = smartsheetHrefFromConfig(
      project.config.smartsheetLink,
    );
    const smartsheetResolvable =
      smartsheetSource.status === "ok" &&
      resolveSmartsheetSheetIdFromLink(smartsheetSource.link) != null;

    let nextProject = { ...project, metrics: [...project.metrics] };

    // Open Tasks / Over Due follow Google Drive Link.
    if (driveSource.status !== "ok") {
      const stubs = taskMetricsForSourceStatus(driveSource.status);
      nextProject = {
        ...nextProject,
        status: statusFromOverdueCount(0),
        taskProgressPercent: 0,
        taskProgressCaption:
          driveSource.status === "empty"
            ? "Google Drive Link empty"
            : "Google Drive Link error",
        metrics: nextProject.metrics.map((metric) => {
          if (metric.label === "Open Tasks") {
            return { ...metric, ...stubs.open };
          }
          if (metric.label === "Over Due") {
            return { ...metric, ...stubs.overdue };
          }
          return metric;
        }),
      };
    } else if (stats) {
      const doneOverOpenPercent =
        stats.openTasks + stats.doneTasks === 0
          ? 0
          : Math.round(
              (stats.doneTasks / (stats.doneTasks + stats.openTasks)) * 1000,
            ) / 10;

      nextProject = {
        ...nextProject,
        status: statusFromOverdueCount(stats.overdueTasks),
        updated: stats.syncedAt ?? nextProject.updated,
        taskProgressPercent: doneOverOpenPercent,
        taskProgressCaption: `${doneOverOpenPercent}% done · ${stats.doneTasks} done / ${stats.openTasks} open`,
        metrics: nextProject.metrics.map((metric) => {
          if (metric.label === "Open Tasks") {
            // Bar length is relative to open count (full when open > 0).
            const openBarPercent = stats.openTasks === 0 ? 0 : 100;
            return {
              ...metric,
              value: stats.openTasks,
              href: driveSource.link,
              valueText: undefined,
              hideValueBar: false,
              barPercent: openBarPercent,
              barLabel:
                stats.openTasks === 0
                  ? "No open tasks with due dates"
                  : `${stats.openTasks} open tasks with due dates`,
              detailItems: stats.openItems,
            };
          }

          if (metric.label === "Over Due") {
            // Bar length is overdue / open so it never exceeds the Open Tasks bar.
            const overdueBarPercent =
              stats.openTasks === 0
                ? 0
                : Math.round(
                    (stats.overdueTasks / stats.openTasks) * 1000,
                  ) / 10;
            return {
              ...metric,
              value: stats.overdueTasks,
              href: driveSource.link,
              valueText: undefined,
              hideValueBar: false,
              barPercent: overdueBarPercent,
              barLabel:
                stats.openTasks === 0
                  ? "No open tasks with due dates"
                  : `${stats.overdueTasks} of ${stats.openTasks} open tasks overdue`,
              detailItems: stats.overdueItems,
            };
          }

          return metric;
        }),
      };
    } else {
      // Valid Google Drive Link but sheet content could not be loaded.
      const stubs = taskMetricsForSourceStatus("invalid");
      nextProject = {
        ...nextProject,
        status: statusFromOverdueCount(0),
        taskProgressPercent: 0,
        taskProgressCaption: "Google Drive Link error",
        metrics: nextProject.metrics.map((metric) => {
          if (metric.label === "Open Tasks") {
            return { ...metric, ...stubs.open };
          }
          if (metric.label === "Over Due") {
            return { ...metric, ...stubs.overdue };
          }
          return metric;
        }),
      };
    }

    // Current Task / Next Task follow Configuration Smartsheet Link.
    if (smartsheetSource.status !== "ok" || !smartsheetConfigHref) {
      const stubs = scheduleMetricsForSourceStatus(smartsheetSource.status);
      nextProject = {
        ...nextProject,
        metrics: nextProject.metrics.map((metric) => {
          if (metric.label === "Current Task") {
            return { ...metric, ...stubs.current };
          }
          if (metric.label === "Next Task") {
            return { ...metric, ...stubs.next };
          }
          return metric;
        }),
      };
    } else if (smartsheetResolvable && scheduleStats) {
      nextProject = {
        ...nextProject,
        metrics: metricsWithScheduleStats(
          nextProject.metrics,
          scheduleStats,
          smartsheetConfigHref,
        ),
      };
    } else if (smartsheetResolvable) {
      // Known sheet but live schedule unavailable (e.g. no API token).
      nextProject = {
        ...nextProject,
        metrics: metricsWithScheduleStats(
          nextProject.metrics,
          fallbackScheduleFromMetrics(nextProject.metrics),
          smartsheetConfigHref,
        ),
      };
    } else {
      // Valid Configuration Smartsheet Link we cannot fetch yet — still link labels.
      const stubs = scheduleMetricsForSourceStatus("ok", smartsheetConfigHref);
      nextProject = {
        ...nextProject,
        metrics: nextProject.metrics.map((metric) => {
          if (metric.label === "Current Task") {
            return { ...metric, ...stubs.current };
          }
          if (metric.label === "Next Task") {
            return { ...metric, ...stubs.next };
          }
          return metric;
        }),
      };
    }

    return nextProject;
  });
}

export default async function Home() {
  const siteConfig = await loadSiteAdminConfig();
  const googleDriveLinksByCode: Record<EsadProjectCode, string> = {
    DSB:
      siteConfig.dashboardConfigs["1"]?.googleDriveLink ??
      DASHBOARD_CONFIGS["1"].googleDriveLink,
    HVFB:
      siteConfig.dashboardConfigs["2"]?.googleDriveLink ??
      DASHBOARD_CONFIGS["2"].googleDriveLink,
    PRI:
      siteConfig.dashboardConfigs["3"]?.googleDriveLink ??
      DASHBOARD_CONFIGS["3"].googleDriveLink,
    IND:
      siteConfig.dashboardConfigs["4"]?.googleDriveLink ??
      DASHBOARD_CONFIGS["4"].googleDriveLink,
  };
  const [taskStatsByCode, scheduleStatsByCode] = await Promise.all([
    fetchAllProjectTaskStats(fetch, googleDriveLinksByCode),
    fetchAllProjectScheduleStats(),
  ]);
  const dashboardProjects = applyLiveProjectStats(
    projects,
    taskStatsByCode,
    scheduleStatsByCode,
  );
  const programStatus = programStatusFromProjects(dashboardProjects);
  const adminCredentials = getAdminCredentials();

  return (
    <CompanyAuthGate>
      <DashboardRefresh />
      <main className="dashboard-shell">
        <HeroHeader
          adminUsername={adminCredentials.username}
          adminPassword={adminCredentials.password}
        />

        <section
          className="systems-grid"
          aria-label="Engineering project portfolio"
        >
          {dashboardProjects.map((project, index) => (
            <ProjectPanel key={project.name} project={project} index={index} />
          ))}
          <HealthCore status={programStatus} />
        </section>

        <CustomCardsSection />
      </main>
    </CompanyAuthGate>
  );
}
