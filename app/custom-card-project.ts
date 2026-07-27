import type { CustomCardRecord } from "../lib/custom-cards";
import {
  scheduleMetricsForSourceStatus,
  taskMetricsForSourceStatus,
} from "../lib/metric-source-state";
import {
  resolveGoogleDriveSource,
  resolveSmartsheetSheetIdFromLink,
  resolveSmartsheetSource,
} from "../lib/source-links";
import type { ProjectPanelProject } from "./project-panel";

/** Build a ProjectPanel project with the same metric layout as fixed cards. */
export function customCardToProject(
  card: CustomCardRecord,
): ProjectPanelProject {
  const driveSource = resolveGoogleDriveSource(card.config.googleDriveLink);
  const smartsheetSource = resolveSmartsheetSource(card.config.smartsheetLink);
  const smartsheetOk =
    smartsheetSource.status === "ok" &&
    resolveSmartsheetSheetIdFromLink(smartsheetSource.link) != null;

  // Custom cards do not server-fetch sheet/schedule rows yet.
  // Blank → Empty; invalid or unresolved/unloaded → Error.
  const taskStatus =
    driveSource.status === "ok" ? "invalid" : driveSource.status;
  const scheduleStatus = smartsheetOk
    ? "invalid"
    : smartsheetSource.status === "ok"
      ? "invalid"
      : smartsheetSource.status;

  const taskStubs = taskMetricsForSourceStatus(taskStatus);
  const scheduleStubs = scheduleMetricsForSourceStatus(scheduleStatus);

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
