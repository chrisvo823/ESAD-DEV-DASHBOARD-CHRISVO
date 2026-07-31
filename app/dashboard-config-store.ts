"use client";

import { useEffect, useState } from "react";
import {
  DASHBOARD_CONFIGS,
  isFixedDashboardId,
  type DashboardConfig,
  type DashboardId,
  type FixedDashboardId,
} from "../lib/dashboard-config";
import { isCustomCardId } from "../lib/custom-cards";
import { requireAdminSessionForDriveWrite } from "./admin-auth";
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

function customCardsFromConfigs(configs: DashboardConfig[]) {
  return configs
    .filter((config) => isCustomCardId(String(config.dashboardId)))
    .map((config) => ({
      id: config.dashboardId,
      config: { ...config, dashboardId: config.dashboardId },
    }));
}

export function readDashboardConfigs(): ConfigMap {
  if (typeof window === "undefined") return cloneDefaults();
  const cached = readCachedDashboardConfigs();
  return Object.keys(cached).length > 0 ? cached : cloneDefaults();
}

/**
 * Bind a Card Configuration Google Doc as the source of truth for one card.
 * Host values are only a cache; all users read from the selected Doc.
 */
export async function bindCardConfigGoogleDoc(options: {
  config: DashboardConfig;
  documentId: string;
}): Promise<ConfigMap> {
  return bindAllCardConfigsGoogleDoc({
    configs: [options.config],
    documentId: options.documentId,
  });
}

/**
 * Bind one Google Doc for one or more Card # sections and publish for all users.
 */
export async function bindAllCardConfigsGoogleDoc(options: {
  configs: DashboardConfig[];
  documentId: string;
}): Promise<ConfigMap> {
  requireAdminSessionForDriveWrite();
  const { configs, documentId } = options;
  const next = { ...readDashboardConfigs() };
  const cardConfigDocumentIds: Record<string, string> = {};
  for (const config of configs) {
    next[config.dashboardId] = { ...config, dashboardId: config.dashboardId };
    cardConfigDocumentIds[config.dashboardId] = documentId;
    emitLegacyConfigEvent(next[config.dashboardId]!);
  }
  await persistSiteConfigPatch({
    dashboardConfigs: {
      ...next,
    },
    cardConfigDocumentIds,
    customCards: customCardsFromConfigs(Object.values(next)),
  });
  return next;
}

/**
 * Save editable card fields to the selected Google Doc and refresh the host
 * cache so every user session picks up the Doc on the next pull.
 */
export async function saveCardConfigToGoogleDoc(options: {
  config: DashboardConfig;
  documentId: string;
}): Promise<ConfigMap> {
  const { config, documentId } = options;
  const next = {
    ...readDashboardConfigs(),
    [config.dashboardId]: { ...config, dashboardId: config.dashboardId },
  };
  emitLegacyConfigEvent(next[config.dashboardId]!);
  await persistSiteConfigPatch({
    dashboardConfig: next[config.dashboardId]!,
    cardConfigDocumentIds: { [config.dashboardId]: documentId },
    customCards: customCardsFromConfigs(Object.values(next)),
    publishCardConfigToGoogleDoc: true,
  });
  return next;
}

/**
 * Save every Card # section from the Card Configuration editor back to one
 * Google Doc (full document replace) and publish for all users.
 */
export async function saveAllCardConfigsToGoogleDoc(options: {
  configs: DashboardConfig[];
  documentId: string;
}): Promise<ConfigMap> {
  requireAdminSessionForDriveWrite();
  const { configs, documentId } = options;
  if (configs.length === 0) {
    throw new Error("Nothing to save — add at least one Card # section.");
  }
  const next = { ...readDashboardConfigs() };
  const cardConfigDocumentIds: Record<string, string> = {
    ...getCachedSiteConfig().cardConfigDocumentIds,
  };
  const published: DashboardConfig[] = [];
  for (const config of configs) {
    const saved = { ...config, dashboardId: config.dashboardId };
    next[config.dashboardId] = saved;
    cardConfigDocumentIds[config.dashboardId] = documentId;
    published.push(saved);
    emitLegacyConfigEvent(saved);
  }
  const publishedIds = new Set(
    published.map((config) => String(config.dashboardId)),
  );
  for (const id of Object.keys(next)) {
    if (isCustomCardId(id) && !publishedIds.has(id)) {
      delete next[id];
      delete cardConfigDocumentIds[id];
    }
  }
  await persistSiteConfigPatch({
    dashboardConfigs: next,
    cardConfigDocumentIds,
    customCards: customCardsFromConfigs(published),
    publishCardConfigToGoogleDoc: true,
    cardConfigsToPublish: published,
  });
  return next;
}

/** @deprecated Prefer bindCardConfigGoogleDoc / saveCardConfigToGoogleDoc. */
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
