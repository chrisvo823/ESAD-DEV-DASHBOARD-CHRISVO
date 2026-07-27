import type { CustomCardRecord } from "../lib/custom-cards";
import {
  scheduleMetricsForSourceStatus,
  taskMetricsForSourceStatus,
} from "../lib/metric-source-state";
import {
  resolveGoogleDriveSource,
  resolveSmartsheetSource,
  smartsheetHrefFromConfig,
} from "../lib/source-links";
import type { ProjectPanelProject } from "./project-panel";

/** Build a ProjectPanel project with the same metric layout as fixed cards. */
export function customCardToProject(
  card: CustomCardRecord,
): ProjectPanelProject {
  const driveSource = resolveGoogleDriveSource(card.config.googleDriveLink);
  const smartsheetSource = resolveSmartsheetSource(card.config.smartsheetLink);
  const smartsheetHref = smartsheetHrefFromConfig(card.config.smartsheetLink);

  // Custom cards do not server-fetch sheet/schedule rows yet.
  // Blank → Empty; invalid URL → Error; valid Smartsheet Link → linked "—".
  const taskStatus =
    driveSource.status === "ok" ? "invalid" : driveSource.status;
  const scheduleStatus = smartsheetSource.status;

  const taskStubs = taskMetricsForSourceStatus(
    taskStatus,
    driveSource.status === "ok" ? driveSource.link : undefined,
  );
  const scheduleStubs = scheduleMetricsForSourceStatus(
    scheduleStatus,
    smartsheetHref ?? undefined,
  );

  return {
    name: card.config.boardName,
    code: card.config.boardNickname,
    status: "On Track",
    boards: [{ name: card.config.boardName, progress: 0 }],
    metrics: [
      {
        label: "Open Tasks",
        ...taskStubs.open,
      },
      {
        label: "Over Due",
        ...taskStubs.overdue,
      },
      {
        label: "Current Task",
        ...scheduleStubs.current,
      },
      {
        label: "Next Task",
        ...scheduleStubs.next,
      },
    ],
    taskProgressPercent: 0,
    taskProgressCaption:
      driveSource.status === "empty"
        ? "Google Drive Link empty"
        : "Google Drive Link error",
    updated: "—",
    config: card.config,
  };
}
