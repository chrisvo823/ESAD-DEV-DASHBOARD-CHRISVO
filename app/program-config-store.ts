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
  subscribeSiteConfig,
} from "./site-config-client";

/** @deprecated Admin config is host-persisted; key kept for migration only. */
export const PROGRAM_CONFIG_STORAGE_KEY = "esad-program-config";
export const PROGRAM_CONFIG_EVENT = "esad-program-config-change";

export function readProgramConfig(): ProgramConfig {
  if (typeof window === "undefined") return { ...DEFAULT_PROGRAM_CONFIG };
  return readCachedProgramConfig();
}

export function writeProgramConfig(config: ProgramConfig): ProgramConfig {
  const next = withDefaultProgramLedThresholds({
    dashboardName: config.dashboardName.trim(),
    programLead: config.programLead.trim(),
    ledGreenAtMost: config.ledGreenAtMost,
    ledYellowAtLeast: config.ledYellowAtLeast,
    ledRedAtLeast: config.ledRedAtLeast,
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(PROGRAM_CONFIG_EVENT, { detail: { config: next } }),
    );
  }
  void persistSiteConfigPatch({ programConfig: next }).catch(() => {
    // Host save failures are surfaced by re-hydration in persist helper.
  });
  return next;
}

export function useProgramConfig(): ProgramConfig {
  const [config, setConfig] = useState<ProgramConfig>(DEFAULT_PROGRAM_CONFIG);

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
