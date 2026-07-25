import { AVIONICS_MASTER_SCHEDULE_PERMALINK } from "./esad-projects.ts";
import type { EsadProjectCode } from "./esad-projects.ts";

/** Fixed dashboard slots: 1 top-left, 2 top-right, 3 bottom-left, 4 bottom-right. */
export type FixedDashboardId = "1" | "2" | "3" | "4";

/** Fixed slot id, or a custom card id (e.g. custom-…). */
export type DashboardId = FixedDashboardId | (string & {});

export const FIXED_DASHBOARD_IDS: readonly FixedDashboardId[] = [
  "1",
  "2",
  "3",
  "4",
] as const;

export function isFixedDashboardId(id: string): id is FixedDashboardId {
  return (FIXED_DASHBOARD_IDS as readonly string[]).includes(id);
}

export type DashboardConfig = {
  /** Internal slot/card id — not shown in the editable Configuration Window text. */
  dashboardId: DashboardId;
  responsibleEngineer: string;
  boardName: string;
  boardNickname: string;
  googleDriveLink: string;
  smartsheetLink: string;
};

/** Default admin credentials (override with ADMIN_USERNAME / ADMIN_PASSWORD). */
export const DEFAULT_ADMIN_USERNAME = "admin";
export const DEFAULT_ADMIN_PASSWORD = "esad";

export function getAdminCredentials(): { username: string; password: string } {
  const username =
    process.env.ADMIN_USERNAME?.trim() ||
    (globalThis as { ADMIN_USERNAME?: string }).ADMIN_USERNAME?.trim() ||
    DEFAULT_ADMIN_USERNAME;
  const password =
    process.env.ADMIN_PASSWORD?.trim() ||
    (globalThis as { ADMIN_PASSWORD?: string }).ADMIN_PASSWORD?.trim() ||
    DEFAULT_ADMIN_PASSWORD;
  return { username, password };
}

/**
 * Per-dashboard configuration.
 * Layout: #1 top-left, #2 top-right, #3 bottom-left, #4 bottom-right.
 * Quoted values in the Configuration Window populate each card.
 */
export const DASHBOARD_CONFIGS: Record<FixedDashboardId, DashboardConfig> = {
  "1": {
    dashboardId: "1",
    responsibleEngineer: "Bruno Abousleiman",
    boardName: "Digital Safety Board",
    boardNickname: "DSB",
    googleDriveLink: "",
    smartsheetLink: AVIONICS_MASTER_SCHEDULE_PERMALINK,
  },
  "2": {
    dashboardId: "2",
    responsibleEngineer: "Bruno Abousleiman",
    boardName: "High Voltage Fireset Board",
    boardNickname: "HVFB",
    googleDriveLink: "",
    smartsheetLink: AVIONICS_MASTER_SCHEDULE_PERMALINK,
  },
  "3": {
    dashboardId: "3",
    responsibleEngineer: "Shane Olson",
    boardName: "CPLD - Primary",
    boardNickname: "PRI",
    googleDriveLink: "",
    smartsheetLink: AVIONICS_MASTER_SCHEDULE_PERMALINK,
  },
  "4": {
    dashboardId: "4",
    responsibleEngineer: "Gary Mejia Martinez",
    boardName: "CPLD - Independent",
    boardNickname: "IND",
    googleDriveLink: "",
    smartsheetLink: AVIONICS_MASTER_SCHEDULE_PERMALINK,
  },
};

export const DASHBOARD_ID_BY_CODE: Record<EsadProjectCode, DashboardId> = {
  DSB: "1",
  HVFB: "2",
  PRI: "3",
  IND: "4",
};

export const CONFIG_FIELD_LABELS = [
  "Responsible Engineer",
  "Board Name",
  "Board Nickname",
  "Google Drive Link",
  "Smartsheet Link",
] as const;

export type ConfigFieldLabel = (typeof CONFIG_FIELD_LABELS)[number];

/** Text-based configuration content shown/edited in the Configuration Window. */
export function formatDashboardConfigText(config: DashboardConfig): string {
  return [
    `Responsible Engineer: "${config.responsibleEngineer}"`,
    `Board Name: "${config.boardName}"`,
    `Board Nickname: "${config.boardNickname}"`,
    `Google Drive Link: "${config.googleDriveLink}"`,
    `Smartsheet Link: "${config.smartsheetLink}"`,
  ].join("\n");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findFieldLine(
  text: string,
  label: ConfigFieldLabel,
): { line: string; lineNumber: number } | null {
  const lines = text.split(/\r?\n/);
  const pattern = new RegExp(`^\\s*${escapeRegExp(label)}\\s*:`, "i");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (pattern.test(line)) {
      return { line, lineNumber: index + 1 };
    }
  }
  return null;
}

/**
 * Validate that each configuration value is wrapped in double quotes.
 * Returns one syntax-error message per invalid/missing field.
 */
export function validateDashboardConfigSyntax(text: string): string[] {
  const errors: string[] = [];

  for (const label of CONFIG_FIELD_LABELS) {
    const found = findFieldLine(text, label);
    if (!found) {
      errors.push(`Syntax error: missing ${label}: "value"`);
      continue;
    }

    const { line, lineNumber } = found;
    const quoted = line.match(
      new RegExp(`^\\s*${escapeRegExp(label)}\\s*:\\s*"([^"]*)"\\s*$`, "i"),
    );
    if (quoted) continue;

    const opensQuote = line.match(
      new RegExp(`^\\s*${escapeRegExp(label)}\\s*:\\s*"`, "i"),
    );
    if (opensQuote) {
      errors.push(
        `Syntax error on line ${lineNumber}: ${label} is missing a closing "`,
      );
      continue;
    }

    const bareValue = line.match(
      new RegExp(`^\\s*${escapeRegExp(label)}\\s*:\\s*(.+)\\s*$`, "i"),
    );
    if (bareValue && bareValue[1].trim() !== "") {
      errors.push(
        `Syntax error on line ${lineNumber}: ${label} value must be inside " "`,
      );
      continue;
    }

    errors.push(
      `Syntax error on line ${lineNumber}: ${label} must use ${label}: "value"`,
    );
  }

  return errors;
}

function readQuotedField(text: string, label: ConfigFieldLabel): string | null {
  const found = findFieldLine(text, label);
  if (!found) return null;
  const match = found.line.match(
    new RegExp(`^\\s*${escapeRegExp(label)}\\s*:\\s*"([^"]*)"\\s*$`, "i"),
  );
  return match ? match[1] : null;
}

/**
 * Parse editable Configuration Window text back into a config object.
 * Dash Board ID is not part of the editable text and is preserved from `base`.
 */
export function parseDashboardConfigText(
  text: string,
  base: DashboardConfig,
): { config: DashboardConfig } | { error: string; errors: string[] } {
  const syntaxErrors = validateDashboardConfigSyntax(text);
  if (syntaxErrors.length > 0) {
    return { error: syntaxErrors[0] ?? "Syntax error", errors: syntaxErrors };
  }

  const responsibleEngineer = readQuotedField(text, "Responsible Engineer");
  const boardName = readQuotedField(text, "Board Name");
  const boardNickname = readQuotedField(text, "Board Nickname");
  const googleDriveLink = readQuotedField(text, "Google Drive Link");
  const smartsheetLink = readQuotedField(text, "Smartsheet Link");

  // validateDashboardConfigSyntax already guarantees quoted fields exist.
  if (
    responsibleEngineer == null ||
    boardName == null ||
    boardNickname == null ||
    googleDriveLink == null ||
    smartsheetLink == null
  ) {
    return {
      error: 'Syntax error: each field must use Label: "value"',
      errors: ['Syntax error: each field must use Label: "value"'],
    };
  }

  const valueErrors: string[] = [];
  if (!boardName.trim()) {
    valueErrors.push("Board Name cannot be empty.");
  }
  if (!boardNickname.trim()) {
    valueErrors.push("Board Nickname cannot be empty.");
  }
  if (valueErrors.length > 0) {
    return { error: valueErrors[0] ?? "Invalid configuration", errors: valueErrors };
  }

  return {
    config: {
      dashboardId: base.dashboardId,
      responsibleEngineer: responsibleEngineer.trim(),
      boardName: boardName.trim(),
      boardNickname: boardNickname.trim(),
      googleDriveLink: googleDriveLink.trim(),
      smartsheetLink: smartsheetLink.trim(),
    },
  };
}

export function getDashboardConfigForCode(
  code: EsadProjectCode,
): DashboardConfig {
  return DASHBOARD_CONFIGS[DASHBOARD_ID_BY_CODE[code]];
}
