import { CompanyAuthGate } from "./company-auth-gate";
import { CustomCardsSection } from "./custom-cards-section";
import { DashboardRefresh } from "./dashboard-refresh";
import { HeroHeader } from "./hero-header";
import { ProjectPanel, type ProjectPanelProject } from "./project-panel";
import { SiteConfigBootstrap } from "./site-config-bootstrap";
import {
  DASHBOARD_CONFIGS,
  getAdminCredentials,
  type DashboardConfig,
} from "../lib/dashboard-config";
import {
  resolveHostDashboardConfig,
  toPublicSiteConfig,
} from "../lib/site-config";
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
  formatProgramPercent,
  statusFromOverdueCount,
  type DsbTaskStats,
  type ProgramTaskTotals,
} from "../lib/dsb-tasks";
import { fetchAllProjectTaskStatsServer } from "../lib/dsb-tasks-server";
import {
  scheduleMetricsForSourceStatus,
  taskMetricsForSourceStatus,
  taskMetricsForUnavailableSheet,
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
  percentComplete: number | null = null,
): DsbScheduleRevision["tasks"][number] {
  return {
    id,
    name,
    start,
    finish,
    percentComplete,
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
        100,
      ),
      scheduleTask(
        6883684287971204,
        "Block Diagram + Review",
        // Smartsheet: Start 07/17/26, Finish 07/23/26
        "2026-07-17T08:00:00",
        "2026-07-23T16:59:59",
        50,
      ),
      // Avionics Master Schedule order: Design Analyses hands off to Schematic
      // on Jul 24 (LA). Live Smartsheet replaces these when the API token is set.
      scheduleTask(
        1254184753758084,
        "Design Analyses (SI/PI/Thermal/EMC)",
        "2026-07-23T16:59:59",
        "2026-07-23T16:59:59",
        100,
      ),
      scheduleTask(
        5757784381128580,
        "Schematic",
        // Smartsheet Current Task: Start 07/24/26, Finish 08/06/26, % Complete 10%
        "2026-07-24T08:00:00",
        "2026-08-06T16:59:59",
        10,
      ),
      // Next after Schematic on the Rev A schedule (not Layout / Rev B).
      scheduleTask(
        3505984567443332,
        "Schematic Review",
        "2026-08-07T08:00:00",
        "2026-08-07T16:59:59",
      ),
      scheduleTask(
        8009584194813828,
        "Generate BUY-BOM",
        "2026-08-10T08:00:00",
        "2026-08-10T16:59:59",
      ),
      scheduleTask(
        691234800336772,
        "Layout",
        "2026-08-11T08:00:00",
        "2026-08-24T16:59:59",
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
        100,
      ),
      scheduleTask(
        7024421776326532,
        "Block Diagram + Review",
        // Smartsheet: Start 07/17/26, Finish 07/23/26
        "2026-07-17T08:00:00",
        "2026-07-23T16:59:59",
        90,
      ),
      scheduleTask(
        1394922242113412,
        "Design Analyses (SI/PI/Thermal/EMC)",
        "2026-07-23T16:59:59",
        "2026-07-23T16:59:59",
        100,
      ),
      scheduleTask(
        5898521869483908,
        "Schematic",
        "2026-07-24T08:00:00",
        "2026-08-06T16:59:59",
        20,
      ),
      scheduleTask(
        3646722055798660,
        "Schematic Review",
        "2026-08-07T08:00:00",
        "2026-08-07T16:59:59",
      ),
      scheduleTask(
        8150321683169156,
        "Generate BUY-BOM",
        "2026-08-10T08:00:00",
        "2026-08-10T16:59:59",
      ),
      scheduleTask(
        831972288692100,
        "Layout",
        "2026-08-11T08:00:00",
        "2026-08-24T16:59:59",
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
        100,
      ),
      scheduleTask(
        583849813409668,
        "Block Diagram Review",
        "2026-07-24T08:00:00",
        "2026-08-10T16:59:59",
        100,
      ),
      scheduleTask(
        5087449440780164,
        "Design & Validation using SDK platform",
        "2026-08-11T08:00:00",
        "2026-09-21T16:59:59",
        10,
      ),
      scheduleTask(
        2835649627094916,
        "Verification on hardware",
        "2026-09-22T08:00:00",
        "2026-10-12T16:59:59",
        0,
      ),
      scheduleTask(
        7339249254465412,
        "Validation on hardware",
        "2026-10-13T08:00:00",
        "2026-10-26T16:59:59",
        0,
      ),
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
        100,
      ),
      scheduleTask(
        2473730970615684,
        "Block Diagram Review",
        "2026-07-24T08:00:00",
        "2026-08-10T16:59:59",
        100,
      ),
      scheduleTask(
        6977330597986180,
        "Design & Validation using SDK platform",
        "2026-08-11T08:00:00",
        "2026-09-21T16:59:59",
        10,
      ),
      scheduleTask(
        1347831063773060,
        "Verification on hardware",
        "2026-09-22T08:00:00",
        "2026-10-12T16:59:59",
        0,
      ),
      scheduleTask(
        5851430691143556,
        "Validation on hardware",
        "2026-10-13T08:00:00",
        "2026-10-26T16:59:59",
        0,
      ),
    ],
  },
];

const projects: Project[] = [
  {
    // Board names come from Google Drive Card Configuration (via host Doc cache).
    name: "",
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
        valueText: "Schematic",
        valueDateLabel:
          formatScheduleDateRange(
            "2026-07-24T08:00:00",
            "2026-08-06T16:59:59",
          ) ?? undefined,
        valuePercentLabel: "10%",
        valueHref: smartsheetRowUrl(5757784381128580),
        focusTaskId: 5757784381128580,
        hideValueBar: true,
        scheduleRevisions: dsbScheduleFallbackRevisions,
      },
      {
        value: 0,
        label: "Next Task",
        href: smartsheetRowUrl(3505984567443332),
        valueText: "Schematic Review",
        valueDateLabel:
          formatScheduleDateRange(
            "2026-08-07T08:00:00",
            "2026-08-07T16:59:59",
          ) ?? undefined,
        valueHref: smartsheetRowUrl(3505984567443332),
        focusTaskId: 3505984567443332,
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
    name: "",
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
        valueText: "Schematic",
        valueDateLabel:
          formatScheduleDateRange(
            "2026-07-24T08:00:00",
            "2026-08-06T16:59:59",
          ) ?? undefined,
        valuePercentLabel: "20%",
        valueHref: smartsheetRowUrl(5898521869483908),
        focusTaskId: 5898521869483908,
        hideValueBar: true,
        scheduleRevisions: hvfbScheduleFallbackRevisions,
      },
      {
        value: 0,
        label: "Next Task",
        href: smartsheetRowUrl(3646722055798660),
        valueText: "Schematic Review",
        valueDateLabel:
          formatScheduleDateRange(
            "2026-08-07T08:00:00",
            "2026-08-07T16:59:59",
          ) ?? undefined,
        valueHref: smartsheetRowUrl(3646722055798660),
        focusTaskId: 3646722055798660,
        hideValueBar: true,
        scheduleRevisions: hvfbScheduleFallbackRevisions,
      },
    ],
    updated: "Jul 21, 2026",
  },
  {
    name: "",
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
        valuePercentLabel: "100%",
        valueHref: smartsheetRowUrl(583849813409668),
        focusTaskId: 583849813409668,
        hideValueBar: true,
        scheduleRevisions: cpldPrimaryScheduleFallbackRevisions,
      },
      {
        value: 0,
        label: "Next Task",
        href: smartsheetRowUrl(5087449440780164),
        valueText: "Design & Validation using SDK platform",
        valueDateLabel:
          formatScheduleDateRange(
            "2026-08-11T08:00:00",
            "2026-09-21T16:59:59",
          ) ?? undefined,
        valueHref: smartsheetRowUrl(5087449440780164),
        focusTaskId: 5087449440780164,
        hideValueBar: true,
        scheduleRevisions: cpldPrimaryScheduleFallbackRevisions,
      },
    ],
    updated: "Jun 23, 2026",
  },
  {
    name: "",
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
        valuePercentLabel: "100%",
        valueHref: smartsheetRowUrl(2473730970615684),
        focusTaskId: 2473730970615684,
        hideValueBar: true,
        scheduleRevisions: cpldIndependentScheduleFallbackRevisions,
      },
      {
        value: 0,
        label: "Next Task",
        href: smartsheetRowUrl(6977330597986180),
        valueText: "Design & Validation using SDK platform",
        valueDateLabel:
          formatScheduleDateRange(
            "2026-08-11T08:00:00",
            "2026-09-21T16:59:59",
          ) ?? undefined,
        valueHref: smartsheetRowUrl(6977330597986180),
        focusTaskId: 6977330597986180,
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
      // Always show Completion % beside Current Task when a task is selected.
      // Blank Smartsheet cells display as 0% (matches sheet empty/% Complete UX).
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
      const stubs = taskMetricsForUnavailableSheet(driveSource.link);
      nextProject = {
        ...nextProject,
        status: statusFromOverdueCount(0),
        taskProgressPercent: 0,
        taskProgressCaption: "Google Drive sheet unavailable",
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

/** Overlay Google Drive Card Configuration (via host Doc cache) onto project slots. */
function withHostCardConfigs(
  projectList: Project[],
  hostConfigs: Record<string, DashboardConfig>,
): Project[] {
  return projectList.map((project) => {
    const config = resolveHostDashboardConfig(
      project.config.dashboardId,
      hostConfigs,
      project.config,
    );
    return {
      ...project,
      // Board name comes only from Google Drive Card Configuration — never from
      // compiled page shell copy.
      name: config.boardName.trim(),
      config,
    };
  });
}

export default async function Home() {
  // Live Hero + cards load from Google Docs (host file is Doc cache only).
  const siteConfig = await loadSiteAdminConfig({ forceGoogleDocRefresh: true });
  const publicSiteConfig = toPublicSiteConfig(siteConfig);
  const hostProjects = withHostCardConfigs(
    projects,
    siteConfig.dashboardConfigs,
  );
  const googleDriveLinksByCode: Record<EsadProjectCode, string> = {
    DSB: siteConfig.dashboardConfigs["1"]?.googleDriveLink?.trim() ?? "",
    HVFB: siteConfig.dashboardConfigs["2"]?.googleDriveLink?.trim() ?? "",
    PRI: siteConfig.dashboardConfigs["3"]?.googleDriveLink?.trim() ?? "",
    IND: siteConfig.dashboardConfigs["4"]?.googleDriveLink?.trim() ?? "",
  };
  const [taskStatsByCode, scheduleStatsByCode] = await Promise.all([
    fetchAllProjectTaskStatsServer(fetch, googleDriveLinksByCode),
    fetchAllProjectScheduleStats(),
  ]);
  const dashboardProjects = applyLiveProjectStats(
    hostProjects,
    taskStatsByCode,
    scheduleStatsByCode,
  );
  const programStatus = programStatusFromProjects(dashboardProjects);
  const adminCredentials = getAdminCredentials();

  return (
    <CompanyAuthGate dashboardName={siteConfig.programConfig.dashboardName}>
      <SiteConfigBootstrap initial={publicSiteConfig}>
        <DashboardRefresh />
        <main className="dashboard-shell">
          <HeroHeader
            adminUsername={adminCredentials.username}
            adminPassword={adminCredentials.password}
            initialProgramConfig={siteConfig.programConfig}
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
      </SiteConfigBootstrap>
    </CompanyAuthGate>
  );
}
