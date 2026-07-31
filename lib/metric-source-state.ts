import type { DsbTaskItem } from "./dsb-tasks";
import type { DsbScheduleRevision } from "./dsb-schedule";
import {
  METRIC_SOURCE_EMPTY,
  METRIC_SOURCE_ERROR,
  METRIC_SOURCE_UNAVAILABLE,
  resolveGoogleDriveSource,
  resolveSmartsheetSource,
  type MetricSourceStatus,
} from "./source-links";

export type TaskMetricPatch = {
  value: number;
  href?: string;
  barPercent?: number;
  barLabel?: string;
  valueText?: string;
  hideValueBar?: boolean;
  detailItems?: DsbTaskItem[];
};

export type ScheduleMetricPatch = {
  value: number;
  href?: string;
  valueText: string;
  valueHref?: string;
  valueDateLabel?: string;
  valuePercentLabel?: string;
  hideValueBar: true;
  barPercent?: undefined;
  barLabel?: undefined;
  scheduleRevisions?: DsbScheduleRevision[];
  focusTaskId?: number;
};

export function googleDriveMetricStatus(
  googleDriveLink: string | null | undefined,
): MetricSourceStatus {
  return resolveGoogleDriveSource(googleDriveLink).status;
}

export function smartsheetMetricStatus(
  smartsheetLink: string | null | undefined,
): MetricSourceStatus {
  return resolveSmartsheetSource(smartsheetLink).status;
}

export function taskMetricsForSourceStatus(
  status: MetricSourceStatus,
  href?: string,
): { open: TaskMetricPatch; overdue: TaskMetricPatch } {
  if (status === "ok") {
    return {
      open: {
        value: 0,
        href,
        barPercent: 0,
        barLabel: "0 of 0 tasks done",
        detailItems: [],
      },
      overdue: {
        value: 0,
        href,
        barPercent: 0,
        barLabel: "No open tasks with due dates",
        detailItems: [],
      },
    };
  }

  const label = status === "empty" ? METRIC_SOURCE_EMPTY : METRIC_SOURCE_ERROR;
  const stub: TaskMetricPatch = {
    value: 0,
    valueText: label,
    hideValueBar: true,
    barPercent: undefined,
    barLabel: undefined,
    detailItems: [],
    href: undefined,
  };
  return { open: { ...stub }, overdue: { ...stub } };
}

/**
 * Valid Google Drive / Sheets link whose CSV could not be loaded
 * (private sheet, empty export, network failure).
 */
export function taskMetricsForUnavailableSheet(
  href?: string,
): { open: TaskMetricPatch; overdue: TaskMetricPatch } {
  const stub: TaskMetricPatch = {
    value: 0,
    valueText: METRIC_SOURCE_UNAVAILABLE,
    hideValueBar: true,
    barPercent: undefined,
    barLabel: undefined,
    detailItems: [],
    href,
  };
  return { open: { ...stub }, overdue: { ...stub } };
}

/**
 * Build Current / Next Task stubs from Smartsheet Link status.
 * When `status` is ok, `href` should be the Configuration Smartsheet Link.
 */
export function scheduleMetricsForSourceStatus(
  status: MetricSourceStatus,
  href?: string,
): { current: ScheduleMetricPatch; next: ScheduleMetricPatch } {
  const label =
    status === "ok"
      ? "—"
      : status === "empty"
        ? METRIC_SOURCE_EMPTY
        : METRIC_SOURCE_ERROR;
  const link = status === "ok" ? href : undefined;
  const stub: ScheduleMetricPatch = {
    value: 0,
    valueText: label,
    hideValueBar: true,
    barPercent: undefined,
    barLabel: undefined,
    // Label opens the Configuration Smartsheet Link; placeholder values are not linked.
    href: link,
    valueHref: undefined,
    valueDateLabel: undefined,
    valuePercentLabel: undefined,
    scheduleRevisions: undefined,
    focusTaskId: undefined,
  };
  return { current: { ...stub }, next: { ...stub } };
}

/**
 * Valid Configuration Smartsheet Link whose live schedule could not be loaded
 * (missing API token, network failure, empty sheet response).
 * Dashboard never substitutes compiled offline schedule fallbacks.
 */
export function scheduleMetricsForUnavailableSheet(
  href?: string,
): { current: ScheduleMetricPatch; next: ScheduleMetricPatch } {
  const stub: ScheduleMetricPatch = {
    value: 0,
    valueText: METRIC_SOURCE_UNAVAILABLE,
    hideValueBar: true,
    barPercent: undefined,
    barLabel: undefined,
    href,
    valueHref: undefined,
    valueDateLabel: undefined,
    valuePercentLabel: undefined,
    scheduleRevisions: undefined,
    focusTaskId: undefined,
  };
  return { current: { ...stub }, next: { ...stub } };
}
