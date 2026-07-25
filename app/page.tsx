import { CustomCardsSection } from "./custom-cards-section";
import { HeroHeader } from "./hero-header";
import { ProjectPanel, type ProjectPanelProject } from "./project-panel";
import {
  DASHBOARD_CONFIGS,
  getAdminCredentials,
} from "../lib/dashboard-config";
import {
  ESAD_PROJECT_INTEGRATIONS,
  googleSheetEditUrl,
  smartsheetRowUrl,
  type EsadProjectCode,
} from "../lib/esad-projects";
import {
  fetchAllProjectScheduleStats,
  formatScheduleDate,
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
        "2026-07-17T08:00:00",
        "2026-07-23T16:59:59",
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
        "2026-07-17T08:00:00",
        "2026-07-23T16:59:59",
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
    ],
  },
];

const projects: Project[] = [
  {
    name: "Digital Safety Board",
    code: "DSB",
    config: DASHBOARD_CONFIGS["1"],
    // Fallback overdue count is 1 → Delayed with default LED thresholds.
    status: "Delayed",
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
        // Fallback when the sheet cannot be fetched: 1 Done / 26 total.
        barPercent: 3.8,
        barLabel: "1 of 26 tasks done",
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
        // Fallback when the sheet cannot be fetched.
        barPercent: 20,
        barLabel: "1 of 5 dated open tasks overdue",
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
        valueText: "Detail Architecture Work",
        valueDateLabel:
          formatScheduleDate("2026-07-16T16:59:59") ?? undefined,
        valueHref: smartsheetRowUrl(2380084660600708),
        focusTaskId: 2380084660600708,
        hideValueBar: true,
        scheduleRevisions: dsbScheduleFallbackRevisions,
      },
      {
        value: 0,
        label: "Next Task",
        href: smartsheetRowUrl(6883684287971204),
        valueText: "Block Diagram + Review",
        valueDateLabel:
          formatScheduleDate("2026-07-17T08:00:00") ?? undefined,
        valueHref: smartsheetRowUrl(6883684287971204),
        focusTaskId: 6883684287971204,
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
    // Fallback overdue count is 5 → Delayed with default LED thresholds.
    status: "Delayed",
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
        valueText: "Detail Architecture Work",
        valueDateLabel:
          formatScheduleDate("2026-07-16T16:59:59") ?? undefined,
        valueHref: smartsheetRowUrl(2520822148956036),
        focusTaskId: 2520822148956036,
        hideValueBar: true,
        scheduleRevisions: hvfbScheduleFallbackRevisions,
      },
      {
        value: 0,
        label: "Next Task",
        href: smartsheetRowUrl(7024421776326532),
        valueText: "Block Diagram + Review",
        valueDateLabel:
          formatScheduleDate("2026-07-17T08:00:00") ?? undefined,
        valueHref: smartsheetRowUrl(7024421776326532),
        focusTaskId: 7024421776326532,
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
        valueText: "Requirements",
        valueDateLabel:
          formatScheduleDate("2026-07-23T16:59:59") ?? undefined,
        valueHref: smartsheetRowUrl(7902199207886724),
        focusTaskId: 7902199207886724,
        hideValueBar: true,
        scheduleRevisions: cpldPrimaryScheduleFallbackRevisions,
      },
      {
        value: 0,
        label: "Next Task",
        href: smartsheetRowUrl(583849813409668),
        valueText: "Block Diagram Review",
        valueDateLabel:
          formatScheduleDate("2026-07-24T08:00:00") ?? undefined,
        valueHref: smartsheetRowUrl(583849813409668),
        focusTaskId: 583849813409668,
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
    // Fallback overdue count is 1 → Delayed with default LED thresholds.
    status: "Delayed",
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
        valueText: "Requirements",
        valueDateLabel:
          formatScheduleDate("2026-07-23T16:59:59") ?? undefined,
        valueHref: smartsheetRowUrl(4725530784300932),
        focusTaskId: 4725530784300932,
        hideValueBar: true,
        scheduleRevisions: cpldIndependentScheduleFallbackRevisions,
      },
      {
        value: 0,
        label: "Next Task",
        href: smartsheetRowUrl(2473730970615684),
        valueText: "Block Diagram Review",
        valueDateLabel:
          formatScheduleDate("2026-07-24T08:00:00") ?? undefined,
        valueHref: smartsheetRowUrl(2473730970615684),
        focusTaskId: 2473730970615684,
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

function applyLiveProjectStats(
  projectList: Project[],
  taskStatsByCode: Partial<Record<EsadProjectCode, DsbTaskStats>>,
  scheduleStatsByCode: Partial<Record<EsadProjectCode, DsbScheduleStats>>,
): Project[] {
  return projectList.map((project) => {
    const stats = taskStatsByCode[project.code] ?? null;
    const scheduleStats = scheduleStatsByCode[project.code] ?? null;
    const sheetHref = sheetEditUrlFor(project.code);

    let nextProject = { ...project, metrics: [...project.metrics] };

    if (stats) {
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
            return {
              ...metric,
              value: stats.openTasks,
              href: sheetHref,
              barPercent: stats.completionPercent,
              barLabel: `${stats.doneTasks} of ${stats.totalTasks} tasks done`,
              detailItems: stats.openItems,
            };
          }

          if (metric.label === "Over Due") {
            return {
              ...metric,
              value: stats.overdueTasks,
              href: sheetHref,
              barPercent: stats.overduePercent,
              barLabel:
                stats.openTasksWithDueDate === 0
                  ? "No open tasks with due dates"
                  : `${stats.overdueTasks} of ${stats.openTasksWithDueDate} dated open tasks overdue`,
              detailItems: stats.overdueItems,
            };
          }

          return metric;
        }),
      };
    } else {
      // Keep Open Tasks / Over Due links pointed at the board's Google Sheet
      // (or Drive folder when the sheet id is not configured yet).
      nextProject = {
        ...nextProject,
        metrics: nextProject.metrics.map((metric) => {
          if (metric.label === "Open Tasks" || metric.label === "Over Due") {
            return { ...metric, href: sheetHref };
          }
          return metric;
        }),
      };
    }

    if (scheduleStats) {
      nextProject = {
        ...nextProject,
        metrics: nextProject.metrics.map((metric) => {
          if (metric.label === "Current Task") {
            const current = scheduleStats.currentTask;
            // Blank Smartsheet % Complete cells read as 0% for in-progress work.
            const percentLabel = current
              ? formatSchedulePercentComplete(current.percentComplete ?? 0)
              : undefined;
            return {
              ...metric,
              value: 0,
              href: scheduleStats.href,
              valueText: current?.name ?? "—",
              valueDateLabel:
                formatScheduleDate(current?.finish) ?? undefined,
              valueHref: current?.permalink ?? scheduleStats.href,
              valuePercentLabel: percentLabel ?? undefined,
              focusTaskId: current?.id,
              hideValueBar: true,
              barPercent: undefined,
              barLabel: undefined,
              scheduleRevisions: scheduleStats.revisions,
            };
          }

          if (metric.label === "Next Task") {
            return {
              ...metric,
              value: 0,
              href: scheduleStats.nextTask?.permalink ?? scheduleStats.href,
              valueText: scheduleStats.nextTask?.name ?? "—",
              valueDateLabel:
                formatScheduleDate(scheduleStats.nextTask?.start) ??
                undefined,
              valueHref:
                scheduleStats.nextTask?.permalink ?? scheduleStats.href,
              focusTaskId: scheduleStats.nextTask?.id,
              hideValueBar: true,
              barPercent: undefined,
              barLabel: undefined,
              scheduleRevisions: scheduleStats.revisions,
            };
          }

          return metric;
        }),
      };
    }

    return nextProject;
  });
}

export default async function Home() {
  const [taskStatsByCode, scheduleStatsByCode] = await Promise.all([
    fetchAllProjectTaskStats(),
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
    <main className="dashboard-shell">
      <HeroHeader
        adminUsername={adminCredentials.username}
        adminPassword={adminCredentials.password}
      />

      <section className="systems-grid" aria-label="Engineering project portfolio">
        {dashboardProjects.map((project, index) => (
          <ProjectPanel key={project.name} project={project} index={index} />
        ))}
        <HealthCore status={programStatus} />
      </section>

      <CustomCardsSection />
    </main>
  );
}
