"use client";

import {
  parseDashboardConfigText,
  type DashboardConfig,
} from "../lib/dashboard-config";
import {
  parseProgramConfigText,
  type ProgramConfig,
} from "../lib/program-config";
import { getGoogleAccessToken } from "./google-access-token";

async function exportGoogleDocPlainText(fileId: string): Promise<string> {
  const token = getGoogleAccessToken();
  if (!token) {
    throw new Error(
      "Sign in with Google (Docs access) to load the selected Drive file.",
    );
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=text/plain`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Failed to read Drive file (${response.status}): ${body.slice(0, 240)}`,
    );
  }
  return response.text();
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
  const text = await exportGoogleDocPlainText(fileId);
  const parsed = parseDashboardConfigText(text, base);
  if ("error" in parsed) {
    throw new Error(
      parsed.errors[0] ??
        "Selected file is not a valid Card Configuration document.",
    );
  }
  return parsed.config;
}
