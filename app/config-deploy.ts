"use client";

import type { DashboardConfig } from "../lib/dashboard-config";
import type { ProgramConfig } from "../lib/program-config";
import {
  getCachedSiteConfig,
  persistSiteConfigPatch,
  refreshSiteConfigFromHost,
} from "./site-config-client";

const DASHBOARD_LOADED_KEY = "esad-admin-dashboard-config-loaded";
const CARD_LOADED_KEY = "esad-admin-card-config-loaded";

export const CONFIG_DEPLOYED_EVENT = "esad-config-deployed-to-all-users";

export type ConfigDeployResult = {
  deployed: boolean;
  message: string;
};

function sessionFlag(key: string): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(key) === "1";
}

function setSessionFlag(key: string, value: boolean): void {
  if (typeof window === "undefined") return;
  if (value) window.sessionStorage.setItem(key, "1");
  else window.sessionStorage.removeItem(key);
}

export function hasLoadedDashboardConfigThisSession(): boolean {
  return sessionFlag(DASHBOARD_LOADED_KEY);
}

export function hasLoadedCardConfigThisSession(): boolean {
  return sessionFlag(CARD_LOADED_KEY);
}

export function bothConfigsLoadedThisSession(): boolean {
  return (
    hasLoadedDashboardConfigThisSession() &&
    hasLoadedCardConfigThisSession()
  );
}

/**
 * After Admin loads Dashboard Configuration and at least one Card Configuration
 * from Drive, re-publish the combined host config so every user session pulls
 * the update (shared Google Doc + host file). Firebase Auth is unchanged —
 * config sharing uses the host `/api/site-config` path.
 */
export async function noteConfigLoadedAndDeployIfReady(kind: {
  dashboard?: ProgramConfig;
  card?: DashboardConfig;
}): Promise<ConfigDeployResult> {
  if (kind.dashboard) {
    setSessionFlag(DASHBOARD_LOADED_KEY, true);
  }
  if (kind.card) {
    setSessionFlag(CARD_LOADED_KEY, true);
  }

  if (!bothConfigsLoadedThisSession()) {
    const waitingFor = !hasLoadedDashboardConfigThisSession()
      ? "Dashboard Configuration"
      : "Card Configuration";
    return {
      deployed: false,
      message: `Saved for all users. Load a ${waitingFor} file next to finish deploying the full configuration.`,
    };
  }

  const cached = getCachedSiteConfig();
  const programConfig = kind.dashboard ?? cached.programConfig;
  const dashboardConfigs = {
    ...cached.dashboardConfigs,
    ...(kind.card
      ? { [kind.card.dashboardId]: { ...kind.card } }
      : null),
  };

  // Combined publish: Google Doc (program) + host file (program + cards).
  await persistSiteConfigPatch({
    programConfig,
    dashboardConfigs,
    customCards: cached.customCards,
  });
  await refreshSiteConfigFromHost();

  const message =
    "Dashboard and Card Configuration deployed to all users. Dashboards refresh every 3 minutes.";
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(CONFIG_DEPLOYED_EVENT, {
        detail: { message, at: new Date().toISOString() },
      }),
    );
  }
  return { deployed: true, message };
}
