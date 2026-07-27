"use client";

import { useEffect, useState } from "react";
import {
  DASHBOARD_CONFIGS,
  FIXED_DASHBOARD_IDS,
  isFixedDashboardId,
  type DashboardConfig,
  type DashboardId,
  type FixedDashboardId,
} from "../lib/dashboard-config";
import { isCustomCardId } from "../lib/custom-cards";

export const DASHBOARD_CONFIG_STORAGE_KEY = "esad-dashboard-configs";
export const DASHBOARD_CONFIG_EVENT = "esad-dashboard-config-change";

type ConfigMap = Record<string, DashboardConfig>;

function cloneDefaults(): ConfigMap {
  return {
    "1": { ...DASHBOARD_CONFIGS["1"] },
    "2": { ...DASHBOARD_CONFIGS["2"] },
    "3": { ...DASHBOARD_CONFIGS["3"] },
    "4": { ...DASHBOARD_CONFIGS["4"] },
  };
}

function mergeEntry(
  id: DashboardId,
  entry: Partial<DashboardConfig> | undefined,
  fallback: DashboardConfig,
): DashboardConfig {
  if (!entry || typeof entry !== "object") {
    return { ...fallback, dashboardId: id };
  }
  return {
    dashboardId: id,
    responsibleEngineer:
      typeof entry.responsibleEngineer === "string"
        ? entry.responsibleEngineer
        : fallback.responsibleEngineer,
    boardName:
      typeof entry.boardName === "string" ? entry.boardName : fallback.boardName,
    boardNickname:
      typeof entry.boardNickname === "string"
        ? entry.boardNickname
        : fallback.boardNickname,
    googleDriveLink:
      typeof entry.googleDriveLink === "string"
        ? entry.googleDriveLink
        : typeof (entry as { jiraEpicLink?: unknown }).jiraEpicLink === "string"
          ? ((entry as { jiraEpicLink: string }).jiraEpicLink)
          : fallback.googleDriveLink,
    smartsheetLink:
      typeof entry.smartsheetLink === "string"
        ? entry.smartsheetLink
        : fallback.smartsheetLink,
  };
}

function emptyCustomFallback(id: DashboardId): DashboardConfig {
  return {
    dashboardId: id,
    responsibleEngineer: "",
    boardName: "New Board",
    boardNickname: "NEW",
    googleDriveLink: "",
    smartsheetLink: "",
  };
}

function mergeStored(raw: unknown): ConfigMap {
  const defaults = cloneDefaults();
  if (!raw || typeof raw !== "object") return defaults;

  const stored = raw as Partial<Record<string, Partial<DashboardConfig>>>;
  for (const id of FIXED_DASHBOARD_IDS) {
    defaults[id] = mergeEntry(id, stored[id], defaults[id]!);
  }

  for (const [id, entry] of Object.entries(stored)) {
    if (isFixedDashboardId(id)) continue;
    if (!isCustomCardId(id)) continue;
    defaults[id] = mergeEntry(id, entry, emptyCustomFallback(id));
  }

  return defaults;
}

export function readDashboardConfigs(): ConfigMap {
  if (typeof window === "undefined") return cloneDefaults();
  try {
    const raw = window.localStorage.getItem(DASHBOARD_CONFIG_STORAGE_KEY);
    if (!raw) return cloneDefaults();
    return mergeStored(JSON.parse(raw));
  } catch {
    return cloneDefaults();
  }
}

export function writeDashboardConfig(config: DashboardConfig): ConfigMap {
  const next = readDashboardConfigs();
  next[config.dashboardId] = { ...config, dashboardId: config.dashboardId };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      DASHBOARD_CONFIG_STORAGE_KEY,
      JSON.stringify(next),
    );
    window.dispatchEvent(
      new CustomEvent(DASHBOARD_CONFIG_EVENT, {
        detail: { config: next[config.dashboardId] },
      }),
    );
  }
  return next;
}

function defaultConfigForId(dashboardId: DashboardId): DashboardConfig {
  if (isFixedDashboardId(dashboardId)) {
    return { ...DASHBOARD_CONFIGS[dashboardId as FixedDashboardId] };
  }
  return readDashboardConfigs()[dashboardId] ?? emptyCustomFallback(dashboardId);
}

export function useDashboardConfig(dashboardId: DashboardId): DashboardConfig {
  const [config, setConfig] = useState<DashboardConfig>(() =>
    defaultConfigForId(dashboardId),
  );

  useEffect(() => {
    setConfig(
      readDashboardConfigs()[dashboardId] ?? defaultConfigForId(dashboardId),
    );

    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<{ config: DashboardConfig }>).detail;
      if (detail?.config?.dashboardId === dashboardId) {
        setConfig(detail.config);
        return;
      }
      setConfig(
        readDashboardConfigs()[dashboardId] ?? defaultConfigForId(dashboardId),
      );
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === DASHBOARD_CONFIG_STORAGE_KEY) {
        setConfig(
          readDashboardConfigs()[dashboardId] ??
            defaultConfigForId(dashboardId),
        );
      }
    };

    window.addEventListener(DASHBOARD_CONFIG_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(DASHBOARD_CONFIG_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [dashboardId]);

  return config;
}
