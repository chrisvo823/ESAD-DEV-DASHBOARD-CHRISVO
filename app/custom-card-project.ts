import type { CustomCardRecord } from "../lib/custom-cards";
import type { ProjectPanelProject } from "./project-panel";

/** Build a ProjectPanel project with the same metric layout as fixed cards. */
export function customCardToProject(
  card: CustomCardRecord,
): ProjectPanelProject {
  return {
    name: card.config.boardName,
    code: card.config.boardNickname,
    status: "On Track",
    boards: [{ name: card.config.boardName, progress: 0 }],
    metrics: [
      {
        value: 0,
        label: "Open Tasks",
        barPercent: 0,
        barLabel: "0 of 0 tasks done",
        detailItems: [],
      },
      {
        value: 0,
        label: "Over Due",
        barPercent: 0,
        barLabel: "No open tasks with due dates",
        detailItems: [],
      },
      {
        value: 0,
        label: "Current Task",
        valueText: "—",
        hideValueBar: true,
      },
      {
        value: 0,
        label: "Next Task",
        valueText: "—",
        hideValueBar: true,
      },
    ],
    taskProgressPercent: 0,
    taskProgressCaption: "0% done · 0 done / 0 open",
    updated: "—",
    config: card.config,
  };
}
