"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import { ConfigWindow } from "./config-window";
import { useDashboardConfig } from "./dashboard-config-store";
import { useProgramConfig } from "./program-config-store";
import { useHostProgramConfig } from "./site-config-bootstrap";
import { ScheduleHoverLabel } from "./schedule-hover";
import {
  toggleSelectedCardId,
  useSelectedCardId,
} from "./selected-card-store";
import { TaskHoverLabel } from "./task-hover";
import type { DashboardConfig } from "../lib/dashboard-config";
import type { EsadProjectCode } from "../lib/esad-projects";
import type { DsbScheduleRevision } from "../lib/dsb-schedule";
import {
  statusFromOverdueCount,
  type DsbIndicatorStatus,
  type DsbTaskItem,
} from "../lib/dsb-tasks";
import {
  scheduleMetricsForSourceStatus,
  taskMetricsForSourceStatus,
} from "../lib/metric-source-state";
import { overdueThresholdsFromProgramConfig } from "../lib/program-config";
import {
  METRIC_SOURCE_EMPTY,
  METRIC_SOURCE_ERROR,
  hrefMatchesSmartsheetConfig,
  resolveGoogleDriveSource,
  resolveSmartsheetSource,
  smartsheetHrefFromConfig,
} from "../lib/source-links";

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
   * Smartsheet Start – Finish range shown immediately after the task name.
   */
  valueDateLabel?: string;
  /** Completion percent label shown to the right of Current Task name. */
  valuePercentLabel?: string;
  hideValueBar?: boolean;
  detailItems?: DsbTaskItem[];
  scheduleRevisions?: DsbScheduleRevision[];
  focusTaskId?: number;
};

function isSchedulePlaceholder(valueText: string | undefined): boolean {
  return (
    !valueText ||
    valueText === "—" ||
    valueText === METRIC_SOURCE_EMPTY ||
    valueText === METRIC_SOURCE_ERROR
  );
}

/**
 * Apply Card Configuration links to metric hrefs.
 * Google Drive Link → Open Tasks / Over Due
 * Smartsheet Link → Current Task / Next Task
 */
function metricsWithLiveLinkState(
  metrics: Metric[],
  googleDriveLink: string,
  smartsheetLink: string,
): Metric[] {
  const driveSource = resolveGoogleDriveSource(googleDriveLink);
  const smartsheetSource = resolveSmartsheetSource(smartsheetLink);
  const smartsheetPermalink = smartsheetHrefFromConfig(smartsheetLink);

  const driveStubs =
    driveSource.status === "ok"
      ? null
      : taskMetricsForSourceStatus(driveSource.status);
  const scheduleStubs =
    smartsheetSource.status === "ok"
      ? null
      : scheduleMetricsForSourceStatus(smartsheetSource.status);

  return metrics.map((metric) => {
    if (driveStubs && metric.label === "Open Tasks") {
      return { ...metric, ...driveStubs.open };
    }
    if (driveStubs && metric.label === "Over Due") {
      return { ...metric, ...driveStubs.overdue };
    }
    if (driveSource.status === "ok" &&
      (metric.label === "Open Tasks" || metric.label === "Over Due")) {
      return { ...metric, href: driveSource.link };
    }

    if (scheduleStubs && metric.label === "Current Task") {
      return { ...metric, ...scheduleStubs.current };
    }
    if (scheduleStubs && metric.label === "Next Task") {
      return { ...metric, ...scheduleStubs.next };
    }

    if (
      smartsheetPermalink &&
      (metric.label === "Current Task" || metric.label === "Next Task")
    ) {
      const placeholder = isSchedulePlaceholder(metric.valueText);
      const valueHref =
        !placeholder &&
        hrefMatchesSmartsheetConfig(metric.valueHref, smartsheetLink)
          ? metric.valueHref
          : !placeholder
            ? smartsheetPermalink
            : undefined;
      return {
        ...metric,
        href: smartsheetPermalink,
        valueHref,
      };
    }

    return metric;
  });
}

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

/** Open Tasks / Over Due bars use the same colors as Program Status legend. */
function programStatusMetricFillClass(label: string): string | null {
  if (label === "Open Tasks") return "metric-fill--program-open";
  if (label === "Over Due") return "metric-fill--program-overdue";
  return null;
}

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
  // Card + Dashboard Configuration are host-sourced (SSR host payload + client pull).
  const config = useDashboardConfig(
    project.config.dashboardId,
    project.config,
  );
  const programConfig = useProgramConfig(useHostProgramConfig());
  const selectedCardId = useSelectedCardId();
  const selected = selectedCardId === config.dashboardId;
  const metrics = metricsWithLiveLinkState(
    project.metrics,
    config.googleDriveLink,
    config.smartsheetLink,
  );
  const overdueTasks = overdueCountFromMetrics(metrics);
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
  const panelClass = [
    layout === "custom"
      ? "project-panel project-panel--custom"
      : `project-panel project-panel--${index + 1}`,
    selected ? "is-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  function handleSelectToggle(
    event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>,
  ) {
    const target = event.target as HTMLElement | null;
    if (target?.closest("a, button, input, textarea, select, label")) {
      return;
    }
    toggleSelectedCardId(config.dashboardId);
  }

  return (
    <article
      className={panelClass}
      data-dashboard-id={config.dashboardId}
      data-card-layout={layout}
      data-selected={selected ? "true" : "false"}
      aria-label={`${config.boardNickname} project card${selected ? ", selected" : ""}`}
      tabIndex={0}
      onClick={handleSelectToggle}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleSelectToggle(event);
        }
      }}
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
        {metrics.map((metric, metricIndex) => {
          const openTasksValue =
            metrics.find((entry) => entry.label === "Open Tasks")?.value ?? 0;
          const showValueBar = !metric.hideValueBar;
          // Open Tasks / Over Due share one scale (open count) so a smaller
          // value never draws a longer bar than a larger value.
          const width = (() => {
            if (
              metric.label === "Open Tasks" ||
              metric.label === "Over Due"
            ) {
              if (metric.value === 0) return 0;
              const scale = Math.max(openTasksValue, metric.value, 1);
              return Math.max(
                2,
                Math.min(100, (metric.value / scale) * 100),
              );
            }
            if (metric.barPercent != null) {
              return Math.max(0, Math.min(100, metric.barPercent));
            }
            const scale = metricIndex === 0 ? 80 : 10;
            return metric.value === 0
              ? 2
              : Math.max(10, Math.min(100, (metric.value / scale) * 100));
          })();
          const isSourceFlag =
            metric.valueText === METRIC_SOURCE_EMPTY ||
            metric.valueText === METRIC_SOURCE_ERROR;
          const sourceFlagClass =
            metric.valueText === METRIC_SOURCE_ERROR
              ? " metric-source-flag metric-source-flag--error"
              : metric.valueText === METRIC_SOURCE_EMPTY
                ? " metric-source-flag metric-source-flag--empty"
                : "";

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
                  {metric.label === "Open Tasks" &&
                  metric.detailItems &&
                  !isSourceFlag ? (
                    <TaskHoverLabel
                      label={metric.label}
                      href={metric.href}
                      items={metric.detailItems}
                      title="Open tasks"
                      emptyText="No open tasks with due dates"
                      tone="open"
                    />
                  ) : metric.label === "Over Due" && !isSourceFlag ? (
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
                    metric.scheduleRevisions &&
                    !isSourceFlag ? (
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
                {showValueBar ? (
                  <dd className={sourceFlagClass.trim() || undefined}>
                    {metric.valueText ?? metric.value}
                  </dd>
                ) : null}
              </div>
              {showValueBar ? (
                <div
                  className="metric-track"
                  aria-label={metric.barLabel}
                  aria-hidden={metric.barLabel ? undefined : true}
                >
                  <span
                    className={[
                      "metric-fill",
                      `metric-fill--${metricIndex}`,
                      programStatusMetricFillClass(metric.label),
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={{ width: `${width}%` }}
                  />
                </div>
              ) : metric.valueText ? (
                <dd className={`metric-task-name${sourceFlagClass}`}>
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
