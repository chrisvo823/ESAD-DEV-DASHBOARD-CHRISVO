"use client";

import { useEffect, useState } from "react";
import {
  DASHBOARD_CONFIGS,
  isFixedDashboardId,
  type DashboardConfig,
  type DashboardId,
  type FixedDashboardId,
} from "../lib/dashboard-config";
import {
  getCachedSiteConfig,
  hydrateSiteConfigFromHost,
  persistSiteConfigPatch,
  readCachedDashboardConfigs,
  subscribeSiteConfig,
} from "./site-config-client";

/** @deprecated Admin config is host-persisted; key kept for migration only. */
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

function defaultConfigForId(dashboardId: DashboardId): DashboardConfig {
  if (isFixedDashboardId(dashboardId)) {
    return { ...DASHBOARD_CONFIGS[dashboardId as FixedDashboardId] };
  }
  return (
    readCachedDashboardConfigs()[dashboardId] ?? emptyCustomFallback(dashboardId)
  );
}

function emitLegacyConfigEvent(config: DashboardConfig) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(DASHBOARD_CONFIG_EVENT, { detail: { config } }),
  );
}

export function readDashboardConfigs(): ConfigMap {
  if (typeof window === "undefined") return cloneDefaults();
  const cached = readCachedDashboardConfigs();
  return Object.keys(cached).length > 0 ? cached : cloneDefaults();
}

export async function writeDashboardConfig(
  config: DashboardConfig,
): Promise<ConfigMap> {
  const next = {
    ...readDashboardConfigs(),
    [config.dashboardId]: { ...config, dashboardId: config.dashboardId },
  };
  emitLegacyConfigEvent(next[config.dashboardId]!);
  await persistSiteConfigPatch({ dashboardConfig: next[config.dashboardId]! });
  return next;
}

export function useDashboardConfig(
  dashboardId: DashboardId,
  /** Host-loaded card Configuration from SSR (required source of truth). */
  hostInitial?: DashboardConfig,
): DashboardConfig {
  const [config, setConfig] = useState<DashboardConfig>(() => {
    if (typeof window !== "undefined") {
      return (
        readCachedDashboardConfigs()[dashboardId] ??
        hostInitial ??
        defaultConfigForId(dashboardId)
      );
    }
    return hostInitial ?? defaultConfigForId(dashboardId);
  });

  useEffect(() => {
    let cancelled = false;

    function configFromHostCache(): DashboardConfig {
      return (
        readCachedDashboardConfigs()[dashboardId] ??
        defaultConfigForId(dashboardId)
      );
    }

    void hydrateSiteConfigFromHost().then(() => {
      if (cancelled) return;
      setConfig(configFromHostCache());
    });

    const unsubscribe = subscribeSiteConfig(() => {
      setConfig(configFromHostCache());
    });

    const onLegacy = (event: Event) => {
      const detail = (event as CustomEvent<{ config: DashboardConfig }>).detail;
      if (detail?.config?.dashboardId === dashboardId) {
        setConfig(detail.config);
      }
    };
    window.addEventListener(DASHBOARD_CONFIG_EVENT, onLegacy);

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener(DASHBOARD_CONFIG_EVENT, onLegacy);
    };
  }, [dashboardId]);

  // Keep cache warm for SSR→client transition readers.
  useEffect(() => {
    void getCachedSiteConfig();
  }, []);

  return config;
}
