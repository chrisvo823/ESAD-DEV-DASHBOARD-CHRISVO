"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_PROGRAM_CONFIG,
  withDefaultProgramLedThresholds,
  type ProgramConfig,
} from "../lib/program-config";
import {
  hydrateSiteConfigFromHost,
  persistSiteConfigPatch,
  readCachedProgramConfig,
  refreshSiteConfigFromHost,
  subscribeSiteConfig,
} from "./site-config-client";

/** @deprecated Admin config is host-persisted; key kept for migration only. */
export const PROGRAM_CONFIG_STORAGE_KEY = "esad-program-config";
export const PROGRAM_CONFIG_EVENT = "esad-program-config-change";

export function readProgramConfig(
  fallback: ProgramConfig = DEFAULT_PROGRAM_CONFIG,
): ProgramConfig {
  if (typeof window === "undefined") return { ...fallback };
  return readCachedProgramConfig();
}

/**
 * Force-pull Dashboard Configuration from the shared Google Doc and apply it
 * to the live Hero for all users on this session.
 */
export async function reloadProgramConfigFromGoogleDoc(): Promise<ProgramConfig> {
  const next = await refreshSiteConfigFromHost();
  const config = next.programConfig;
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(PROGRAM_CONFIG_EVENT, { detail: { config } }),
    );
  }
  return config;
}

export type WriteProgramConfigOptions = {
  /** Google Doc to write immediately (Load Config selection or shared default). */
  documentId?: string;
};

/**
 * Persist Dashboard Configuration to the bound Google Doc immediately, then
 * refresh the host cache so every user session picks up the Doc.
 */
export async function writeProgramConfig(
  config: ProgramConfig,
  options?: WriteProgramConfigOptions,
): Promise<ProgramConfig> {
  const lead = config.programLead.trimStart();
  const next = withDefaultProgramLedThresholds({
    dashboardName: config.dashboardName.trim(),
    // Keep a single trailing space when present (e.g. default "Project Lead: ").
    programLead: lead.trim()
      ? `${lead.trim()}${lead.endsWith(" ") ? " " : ""}`
      : "",
    openTasksLabel: config.openTasksLabel.trim(),
    overDueLabel: config.overDueLabel.trim(),
    currentTaskLabel: config.currentTaskLabel.trim(),
    nextTaskLabel: config.nextTaskLabel.trim(),
    ledGreenAtMost: config.ledGreenAtMost,
    ledYellowAtLeast: config.ledYellowAtLeast,
    ledRedAtLeast: config.ledRedAtLeast,
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(PROGRAM_CONFIG_EVENT, { detail: { config: next } }),
    );
  }
  const patch: {
    programConfig: ProgramConfig;
    dashboardConfigDocumentId?: string;
  } = { programConfig: next };
  const documentId = options?.documentId?.trim();
  if (documentId) {
    patch.dashboardConfigDocumentId = documentId;
  }
  await persistSiteConfigPatch(patch);
  return next;
}

export function useProgramConfig(
  /** Host-loaded Dashboard Configuration from SSR (required source of truth). */
  hostInitial: ProgramConfig = DEFAULT_PROGRAM_CONFIG,
): ProgramConfig {
  const [config, setConfig] = useState<ProgramConfig>(() => {
    if (typeof window !== "undefined") {
      return readCachedProgramConfig();
    }
    return hostInitial;
  });

  useEffect(() => {
    let cancelled = false;
    void hydrateSiteConfigFromHost().then(() => {
      if (!cancelled) setConfig(readCachedProgramConfig());
    });

    const unsubscribe = subscribeSiteConfig(() => {
      setConfig(readCachedProgramConfig());
    });
    const onLegacy = (event: Event) => {
      const detail = (event as CustomEvent<{ config: ProgramConfig }>).detail;
      if (detail?.config) setConfig(detail.config);
    };
    window.addEventListener(PROGRAM_CONFIG_EVENT, onLegacy);

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener(PROGRAM_CONFIG_EVENT, onLegacy);
    };
  }, []);

  return config;
}
