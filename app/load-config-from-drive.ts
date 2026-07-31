"use client";

import {
  parseAllDashboardConfigsFromText,
  type DashboardConfig,
} from "../lib/dashboard-config";
import {
  parseProgramConfigText,
  type ProgramConfig,
} from "../lib/program-config";
import { getAdminSessionPassword } from "./admin-auth";
import { getGoogleAccessToken } from "./google-access-token";

async function exportGoogleDocPlainText(fileId: string): Promise<string> {
  const password = getAdminSessionPassword();
  if (!password) {
    throw new Error("Admin session required to load a Drive configuration file.");
  }

  const headers: Record<string, string> = {
    "x-esad-admin-password": password,
  };
  const googleToken = getGoogleAccessToken();
  if (googleToken) {
    headers["x-esad-google-access-token"] = googleToken;
  }

  const response = await fetch(
    `/api/admin-config-drive-files/${encodeURIComponent(fileId)}`,
    {
      headers,
      cache: "no-store",
    },
  );
  const payload = (await response.json()) as {
    text?: string;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(
      payload.error?.trim() ||
        `Failed to read Drive file (${response.status}).`,
    );
  }
  const text = typeof payload.text === "string" ? payload.text : "";
  if (!text.trim()) {
    throw new Error("Selected Drive file was empty.");
  }
  return text;
}

/** Load and parse a Dashboard Configuration Google Doc selected from Drive. */
export async function loadProgramConfigFromDriveFile(
  fileId: string,
): Promise<ProgramConfig> {
  const text = await exportGoogleDocPlainText(fileId);
  const parsed = parseProgramConfigText(text);
  if ("error" in parsed) {
    throw new Error(
      parsed.errors[0] ??
        "Selected file is not a valid Dashboard Configuration document.",
    );
  }
  return parsed.config;
}

/** Load and parse a Card Configuration Google Doc selected from Drive. */
export async function loadCardConfigFromDriveFile(
  fileId: string,
  base: DashboardConfig,
): Promise<DashboardConfig> {
  const configs = await loadAllCardConfigsFromDriveFile(fileId);
  return (
    configs.find((config) => config.dashboardId === base.dashboardId) ??
    configs[0]!
  );
}

/**
 * Load every Card # section from a Card Configuration Google Doc.
 * Each section configures the matching card by Card # id.
 */
export async function loadAllCardConfigsFromDriveFile(
  fileId: string,
): Promise<DashboardConfig[]> {
  const text = await exportGoogleDocPlainText(fileId);
  const parsed = parseAllDashboardConfigsFromText(text);
  if ("error" in parsed) {
    throw new Error(
      parsed.errors[0] ??
        "Selected file is not a valid Card Configuration document.",
    );
  }
  return parsed.configs;
}
