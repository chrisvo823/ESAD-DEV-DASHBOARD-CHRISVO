"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_PROGRAM_CONFIG,
  withDefaultProgramLedThresholds,
  type ProgramConfig,
} from "../lib/program-config";

export const PROGRAM_CONFIG_STORAGE_KEY = "esad-program-config";
export const PROGRAM_CONFIG_EVENT = "esad-program-config-change";

function mergeStored(raw: unknown): ProgramConfig {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_PROGRAM_CONFIG };
  }
  const stored = raw as Partial<ProgramConfig>;
  return withDefaultProgramLedThresholds({
    dashboardName:
      typeof stored.dashboardName === "string" && stored.dashboardName.trim()
        ? stored.dashboardName
        : DEFAULT_PROGRAM_CONFIG.dashboardName,
    programLead:
      typeof stored.programLead === "string" && stored.programLead.trim()
        ? stored.programLead
        : DEFAULT_PROGRAM_CONFIG.programLead,
    ledGreenLessThan:
      typeof stored.ledGreenLessThan === "number" &&
      Number.isFinite(stored.ledGreenLessThan)
        ? stored.ledGreenLessThan
        : DEFAULT_PROGRAM_CONFIG.ledGreenLessThan,
    ledYellowGreaterThan:
      typeof stored.ledYellowGreaterThan === "number" &&
      Number.isFinite(stored.ledYellowGreaterThan)
        ? stored.ledYellowGreaterThan
        : DEFAULT_PROGRAM_CONFIG.ledYellowGreaterThan,
    ledRedGreaterThan:
      typeof stored.ledRedGreaterThan === "number" &&
      Number.isFinite(stored.ledRedGreaterThan)
        ? stored.ledRedGreaterThan
        : DEFAULT_PROGRAM_CONFIG.ledRedGreaterThan,
  });
}

export function readProgramConfig(): ProgramConfig {
  if (typeof window === "undefined") return { ...DEFAULT_PROGRAM_CONFIG };
  try {
    const raw = window.localStorage.getItem(PROGRAM_CONFIG_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROGRAM_CONFIG };
    return mergeStored(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_PROGRAM_CONFIG };
  }
}

export function writeProgramConfig(config: ProgramConfig): ProgramConfig {
  const next = withDefaultProgramLedThresholds({
    dashboardName: config.dashboardName.trim(),
    programLead: config.programLead.trim(),
    ledGreenLessThan: config.ledGreenLessThan,
    ledYellowGreaterThan: config.ledYellowGreaterThan,
    ledRedGreaterThan: config.ledRedGreaterThan,
  });
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      PROGRAM_CONFIG_STORAGE_KEY,
      JSON.stringify(next),
    );
    window.dispatchEvent(
      new CustomEvent(PROGRAM_CONFIG_EVENT, { detail: { config: next } }),
    );
  }
  return next;
}

export function useProgramConfig(): ProgramConfig {
  const [config, setConfig] = useState<ProgramConfig>(DEFAULT_PROGRAM_CONFIG);

  useEffect(() => {
    setConfig(readProgramConfig());

    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<{ config: ProgramConfig }>).detail;
      if (detail?.config) {
        setConfig(detail.config);
        return;
      }
      setConfig(readProgramConfig());
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === PROGRAM_CONFIG_STORAGE_KEY) {
        setConfig(readProgramConfig());
      }
    };

    window.addEventListener(PROGRAM_CONFIG_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(PROGRAM_CONFIG_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return config;
}
