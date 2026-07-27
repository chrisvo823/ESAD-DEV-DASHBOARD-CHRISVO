import type { DashboardConfig, DashboardId } from "./dashboard-config.ts";

/** Persisted admin-created card (appended below the fixed top 4). */
export type CustomCardRecord = {
  id: DashboardId;
  config: DashboardConfig;
};

export function createCustomCardId(): DashboardId {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `custom-${crypto.randomUUID()}`;
  }
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createDefaultCustomCardConfig(
  id: DashboardId,
  sequence: number,
): DashboardConfig {
  const n = Math.max(1, sequence);
  return {
    dashboardId: id,
    responsibleEngineer: "",
    boardName: `New Board ${n}`,
    boardNickname: `NB${n}`,
    googleDriveLink: "",
    smartsheetLink: "",
  };
}

export function createCustomCardRecord(sequence: number): CustomCardRecord {
  const id = createCustomCardId();
  return {
    id,
    config: createDefaultCustomCardConfig(id, sequence),
  };
}

export function isCustomCardId(id: string): boolean {
  return id.startsWith("custom-");
}
