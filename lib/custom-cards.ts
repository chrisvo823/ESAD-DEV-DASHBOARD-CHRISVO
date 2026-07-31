import {
  isFixedDashboardId,
  type DashboardConfig,
  type DashboardId,
} from "./dashboard-config";

/** Persisted admin-created card (appended below the fixed top 4). */
export type CustomCardRecord = {
  id: DashboardId;
  config: DashboardConfig;
};

/**
 * Next Card # after the highest numeric id already in use.
 * Fixed cards are 1–4, so the first added card becomes 5.
 */
export function nextSequentialCardId(
  existingIds: Iterable<string>,
): DashboardId {
  let max = 0;
  for (const id of existingIds) {
    if (!/^\d+$/.test(id)) continue;
    const value = Number(id);
    if (Number.isFinite(value) && value > max) max = value;
  }
  return String(Math.max(max, 0) + 1);
}

export function createDefaultCustomCardConfig(
  id: DashboardId,
  sequence?: number,
): DashboardConfig {
  const n =
    sequence ??
    ( /^\d+$/.test(id) ? Number(id) : 1);
  const label = Number.isFinite(n) && n > 0 ? n : 1;
  return {
    dashboardId: id,
    responsibleEngineer: "",
    boardName: `New Board ${label}`,
    boardNickname: `NB${label}`,
    googleDriveLink: "",
    smartsheetLink: "",
  };
}

export function createCustomCardRecord(
  existingIds: Iterable<string>,
): CustomCardRecord {
  const id = nextSequentialCardId(existingIds);
  return {
    id,
    config: createDefaultCustomCardConfig(id),
  };
}

/** True for admin-added cards: legacy `custom-…` ids or numeric ids beyond 1–4. */
export function isCustomCardId(id: string): boolean {
  if (!id) return false;
  if (id.startsWith("custom-")) return true;
  return /^\d+$/.test(id) && !isFixedDashboardId(id);
}
