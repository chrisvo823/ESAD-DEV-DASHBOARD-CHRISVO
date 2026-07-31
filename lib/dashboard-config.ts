import {
  AVIONICS_MASTER_SCHEDULE_PERMALINK,
  ESAD_PROJECT_INTEGRATIONS,
  googleSheetEditUrl,
} from "./esad-projects";
import type { EsadProjectCode } from "./esad-projects";

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
  /**
   * Card slot id — also the Card # value in Configuration text for fixed cards
   * ("1"–"4").
   */
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
    googleDriveLink: googleSheetEditUrl(
      ESAD_PROJECT_INTEGRATIONS.DSB.googleSheetId,
    ),
    smartsheetLink: AVIONICS_MASTER_SCHEDULE_PERMALINK,
  },
  "2": {
    dashboardId: "2",
    responsibleEngineer: "Bruno Abousleiman",
    boardName: "High Voltage Fireset Board",
    boardNickname: "HVFB",
    googleDriveLink: googleSheetEditUrl(
      ESAD_PROJECT_INTEGRATIONS.HVFB.googleSheetId,
    ),
    smartsheetLink: AVIONICS_MASTER_SCHEDULE_PERMALINK,
  },
  "3": {
    dashboardId: "3",
    responsibleEngineer: "Shane Olson",
    boardName: "CPLD - Primary",
    boardNickname: "PRI",
    googleDriveLink: googleSheetEditUrl(
      ESAD_PROJECT_INTEGRATIONS.PRI.googleSheetId,
    ),
    smartsheetLink: AVIONICS_MASTER_SCHEDULE_PERMALINK,
  },
  "4": {
    dashboardId: "4",
    responsibleEngineer: "Gary Mejia Martinez",
    boardName: "CPLD - Independent",
    boardNickname: "IND",
    googleDriveLink: googleSheetEditUrl(
      ESAD_PROJECT_INTEGRATIONS.IND.googleSheetId,
    ),
    smartsheetLink: AVIONICS_MASTER_SCHEDULE_PERMALINK,
  },
};

export const DASHBOARD_ID_BY_CODE: Record<EsadProjectCode, FixedDashboardId> = {
  DSB: "1",
  HVFB: "2",
  PRI: "3",
  IND: "4",
};

export const CONFIG_FIELD_LABELS = [
  "Card #",
  "Responsible Engineer",
  "Board Name",
  "Board Nickname",
  "Google Drive Link",
  "Smartsheet Link",
] as const;

export type ConfigFieldLabel = (typeof CONFIG_FIELD_LABELS)[number];

/** Display label shown on the card chrome, e.g. "Card #1". */
export function formatCardNumberLabel(dashboardId: DashboardId): string {
  return `Card #${dashboardId}`;
}

/**
 * Normalize Card # text values like "1", "Card #2", or "#3" to a dashboard id.
 */
export function normalizeCardNumber(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(?:card\s*#\s*|\#\s*)?(\d+)$/i);
  if (!match?.[1]) return null;
  return match[1];
}

/** Text-based configuration content shown in the Configuration Window. */
export function formatDashboardConfigText(config: DashboardConfig): string {
  return [
    `Card #: "${config.dashboardId}"`,
    `Responsible Engineer: "${config.responsibleEngineer}"`,
    `Board Name: "${config.boardName}"`,
    `Board Nickname: "${config.boardNickname}"`,
    `Google Drive Link: "${config.googleDriveLink}"`,
    `Smartsheet Link: "${config.smartsheetLink}"`,
  ].join("\n");
}

/** Join multiple card config blocks for the top-level Card Configuration view. */
export function formatAllDashboardConfigsText(
  configs: readonly DashboardConfig[],
): string {
  return configs.map((config) => formatDashboardConfigText(config)).join("\n\n");
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

const EMPTY_BASE_CONFIG: DashboardConfig = {
  dashboardId: "1",
  responsibleEngineer: "",
  boardName: "New Board",
  boardNickname: "NEW",
  googleDriveLink: "",
  smartsheetLink: "",
};

/**
 * Split a Card Configuration document into one block per Card # section.
 */
export function splitCardConfigBlocks(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const blocks: string[] = [];
  let current: string[] = [];
  const cardLine = /^\s*Card #\s*:/i;

  for (const line of lines) {
    if (cardLine.test(line) && current.some((entry) => entry.trim())) {
      blocks.push(current.join("\n"));
      current = [line];
      continue;
    }
    current.push(line);
  }
  if (current.some((entry) => entry.trim())) {
    blocks.push(current.join("\n"));
  }
  return blocks;
}

/**
 * Parse Configuration Window text into a config object.
 * Card # is the card id (e.g. "1" for Card #1). When missing, `base.dashboardId`
 * is preserved for backward compatibility.
 */
export function parseDashboardConfigText(
  text: string,
  base: DashboardConfig = EMPTY_BASE_CONFIG,
): { config: DashboardConfig } | { error: string; errors: string[] } {
  const syntaxErrors = validateDashboardConfigSyntax(text);
  if (syntaxErrors.length > 0) {
    return { error: syntaxErrors[0] ?? "Syntax error", errors: syntaxErrors };
  }

  const cardNumberRaw = readQuotedField(text, "Card #");
  const responsibleEngineer = readQuotedField(text, "Responsible Engineer");
  const boardName = readQuotedField(text, "Board Name");
  const boardNickname = readQuotedField(text, "Board Nickname");
  const googleDriveLink = readQuotedField(text, "Google Drive Link");
  const smartsheetLink = readQuotedField(text, "Smartsheet Link");

  if (
    cardNumberRaw == null ||
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
  const cardNumber = normalizeCardNumber(cardNumberRaw);
  if (!cardNumber) {
    valueErrors.push('Card # must be a number like "1".');
  } else if (!isFixedDashboardId(cardNumber)) {
    valueErrors.push('Card # must be "1", "2", "3", or "4".');
  }
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
      dashboardId: cardNumber ?? base.dashboardId,
      responsibleEngineer: responsibleEngineer.trim(),
      boardName: boardName.trim(),
      boardNickname: boardNickname.trim(),
      googleDriveLink: googleDriveLink.trim(),
      smartsheetLink: smartsheetLink.trim(),
    },
  };
}

/**
 * Parse a Card Configuration Google Doc that may contain one or more Card #
 * sections. Each section configures the matching card by Card # id.
 */
export function parseAllDashboardConfigsFromText(
  text: string,
): { configs: DashboardConfig[] } | { error: string; errors: string[] } {
  const blocks = splitCardConfigBlocks(text);
  if (blocks.length === 0) {
    return {
      error: 'Syntax error: missing Card #: "value"',
      errors: ['Syntax error: missing Card #: "value"'],
    };
  }

  const configs: DashboardConfig[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const block of blocks) {
    const parsed = parseDashboardConfigText(block);
    if ("error" in parsed) {
      errors.push(...parsed.errors);
      continue;
    }
    if (seen.has(parsed.config.dashboardId)) {
      errors.push(
        `Syntax error: duplicate Card #: "${parsed.config.dashboardId}".`,
      );
      continue;
    }
    seen.add(parsed.config.dashboardId);
    configs.push(parsed.config);
  }

  if (configs.length === 0) {
    return {
      error: errors[0] ?? "Selected file is not a valid Card Configuration document.",
      errors:
        errors.length > 0
          ? errors
          : ["Selected file is not a valid Card Configuration document."],
    };
  }

  // Prefer successful card parses even when a later block has errors.
  return { configs };
}

export function getDashboardConfigForCode(
  code: EsadProjectCode,
): DashboardConfig {
  return DASHBOARD_CONFIGS[DASHBOARD_ID_BY_CODE[code]];
}
