"use client";

import { ConfigWindow } from "./config-window";
import { useDashboardConfig } from "./dashboard-config-store";
import { useProgramConfig } from "./program-config-store";
import { ScheduleHoverLabel } from "./schedule-hover";
import { TaskHoverLabel } from "./task-hover";
import type { DashboardConfig } from "../lib/dashboard-config";
import type { EsadProjectCode } from "../lib/esad-projects";
import type { DsbScheduleRevision } from "../lib/dsb-schedule";
import {
  statusFromOverdueCount,
  type DsbIndicatorStatus,
  type DsbTaskItem,
} from "../lib/dsb-tasks";
import { overdueThresholdsFromProgramConfig } from "../lib/program-config";

type Board = { name: string; progress: number };
type Metric = {
  value: number;
  label: string;
  href?: string;
  barPercent?: number;
  barLabel?: string;
  valueText?: string;
  valueHref?: string;
  /**
   * Smartsheet date shown immediately after the task name.
   * Current Task uses Finish; Next Task uses Start.
   */
  valueDateLabel?: string;
  /** Completion percent label shown to the right of Current Task name. */
  valuePercentLabel?: string;
  hideValueBar?: boolean;
  detailItems?: DsbTaskItem[];
  scheduleRevisions?: DsbScheduleRevision[];
  focusTaskId?: number;
};

export type ProjectPanelProject = {
  name: string;
  /** Fixed board code, or custom board nickname. */
  code: EsadProjectCode | string;
  status: DsbIndicatorStatus;
  boards: Board[];
  metrics: Metric[];
  updated: string;
  taskProgressPercent?: number;
  taskProgressCaption?: string;
  config: DashboardConfig;
};

const metricIcons = ["◷", "▤", "▥", "▸"];

function overdueCountFromMetrics(metrics: Metric[]): number {
  const overdueMetric = metrics.find((metric) => metric.label === "Over Due");
  const value = overdueMetric?.value;
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, value)
    : 0;
}

export function ProjectPanel({
  project,
  index,
  layout = "fixed",
}: {
  project: ProjectPanelProject;
  index: number;
  /** `custom` cards sit below the top-4 grid and skip ring inset classes. */
  layout?: "fixed" | "custom";
}) {
  const config = useDashboardConfig(project.config.dashboardId);
  const programConfig = useProgramConfig();
  const overdueTasks = overdueCountFromMetrics(project.metrics);
  const status = statusFromOverdueCount(
    overdueTasks,
    overdueThresholdsFromProgramConfig(programConfig),
  );
  const boardAverage = Math.round(
    project.boards.reduce((total, board) => total + board.progress, 0) /
      Math.max(1, project.boards.length),
  );
  const progressPercent = project.taskProgressPercent ?? boardAverage;
  const progressCaption =
    project.taskProgressCaption ?? `${boardAverage}% average progress`;
  const progressAriaLabel =
    project.taskProgressPercent != null
      ? `Task progress ${progressPercent} percent done versus open`
      : `Average board progress ${boardAverage} percent`;
  const panelClass =
    layout === "custom"
      ? "project-panel project-panel--custom"
      : `project-panel project-panel--${index + 1}`;

  return (
    <article
      className={panelClass}
      data-dashboard-id={config.dashboardId}
      data-card-layout={layout}
    >
      <div className="panel-topline" aria-hidden="true" />
      <header className="panel-header">
        <div className="panel-identity">
          <div className="blueprint-tile" aria-hidden="true">
            <span>{config.boardNickname}</span>
            <i />
          </div>
          <p className="responsible-engineer">
            <span>Responsible Engineer</span>
            <strong>{config.responsibleEngineer || "—"}</strong>
          </p>
        </div>
        <div className="panel-title">
          <div className="panel-status-block">
            <div className="signal-lights" aria-label={`${status} project`}>
              <i className={status === "On Track" ? "active" : ""} />
              <i className={status === "Delayed" ? "active" : ""} />
              <i className={status === "At Risk" ? "active" : ""} />
            </div>
            <p>{status}</p>
          </div>
          <h2 title={config.boardName}>{config.boardName}</h2>
          <div className="board-summary" aria-label={progressAriaLabel}>
            <span
              style={{
                width: `${Math.max(0, Math.min(100, progressPercent))}%`,
              }}
            />
          </div>
          <small>{progressCaption}</small>
        </div>
        <div className="panel-header-actions">
          <ConfigWindow config={config} />
        </div>
      </header>

      <div className="tech-divider" />

      <dl className="panel-metrics">
        {project.metrics.map((metric, metricIndex) => {
          const scale = metricIndex === 0 ? 80 : 10;
          const width =
            metric.barPercent != null
              ? Math.max(0, Math.min(100, metric.barPercent))
              : metric.value === 0
                ? 2
                : Math.max(10, Math.min(100, (metric.value / scale) * 100));
          const showValueBar = !metric.hideValueBar;

          return (
            <div
              className={`metric-row${showValueBar ? "" : " metric-row--text"}`}
              key={metric.label}
            >
              <span className="metric-icon" aria-hidden="true">
                {metricIcons[metricIndex]}
              </span>
              <div className="metric-copy">
                <dt>
                  {metric.label === "Open Tasks" && metric.detailItems ? (
                    <TaskHoverLabel
                      label={metric.label}
                      href={metric.href}
                      items={metric.detailItems}
                      title="Open tasks"
                      emptyText="No open tasks"
                      tone="open"
                    />
                  ) : metric.label === "Over Due" ? (
                    <TaskHoverLabel
                      label={metric.label}
                      href={metric.href}
                      items={metric.detailItems ?? []}
                      title="Overdue items"
                      emptyText="No overdue tasks"
                      tone="overdue"
                    />
                  ) : (metric.label === "Current Task" ||
                      metric.label === "Next Task") &&
                    metric.scheduleRevisions ? (
                    <ScheduleHoverLabel
                      label={metric.label}
                      href={metric.href}
                      revisions={metric.scheduleRevisions}
                      focus={
                        metric.label === "Next Task" ? "next" : "current"
                      }
                      focusTaskId={metric.focusTaskId}
                    />
                  ) : metric.href ? (
                    <a
                      className="metric-link"
                      href={metric.href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {metric.label}
                    </a>
                  ) : (
                    metric.label
                  )}
                </dt>
                {showValueBar ? <dd>{metric.value}</dd> : null}
              </div>
              {showValueBar ? (
                <div
                  className="metric-track"
                  aria-label={metric.barLabel}
                  aria-hidden={metric.barLabel ? undefined : true}
                >
                  <span
                    className={`metric-fill metric-fill--${metricIndex}`}
                    style={{ width: `${width}%` }}
                  />
                </div>
              ) : metric.valueText ? (
                <dd className="metric-task-name">
                  {metric.valueHref || metric.href ? (
                    <a
                      className="metric-task-name-link"
                      href={metric.valueHref ?? metric.href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {metric.valueText}
                    </a>
                  ) : (
                    <span className="metric-task-name-text">
                      {metric.valueText}
                    </span>
                  )}
                  {metric.valueDateLabel ? (
                    <span className="metric-task-date">
                      {metric.valueDateLabel}
                    </span>
                  ) : null}
                  {metric.valuePercentLabel ? (
                    <span className="metric-task-percent">
                      {metric.valuePercentLabel}
                    </span>
                  ) : null}
                </dd>
              ) : null}
            </div>
          );
        })}
      </dl>

      <p className="panel-updated">SYNC {project.updated.toUpperCase()}</p>
    </article>
  );
}
