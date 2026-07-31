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

/**
 * Normalize Google Doc / pasted Card Configuration text before parsing.
 * Handles BOM, smart quotes, and non-breaking spaces that otherwise make
 * valid Card # lines look "missing".
 */
export function normalizeConfigDocText(text: string): string {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u00AB\u00BB]/g, '"')
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/\u00A0/g, " ")
    .replace(/\u200B|\u200C|\u200D|\uFEFF/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
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

/** True when a line starts a Card # section (several Google Doc styles). */
export function isCardNumberSectionLine(line: string): boolean {
  const normalized = normalizeConfigDocText(line).trim();
  return (
    /^Card\s*#\s*:/i.test(normalized) ||
    /^Card\s*#\s*\d+\s*:?\s*$/i.test(normalized) ||
    /^Card\s*#\s*\d+\s*:/i.test(normalized)
  );
}

/** Extract the card id from a Card # section/header/value line. */
export function readCardNumberFromLine(line: string): string | null {
  const normalized = normalizeConfigDocText(line).trim();
  const withLabel = normalized.match(
    /^Card\s*#\s*:\s*"?([^"]*?)"?\s*$/i,
  );
  if (withLabel?.[1] != null) {
    return normalizeCardNumber(withLabel[1]);
  }
  const header = normalized.match(/^Card\s*#\s*(\d+)\s*:?\s*$/i);
  if (header?.[1]) return normalizeCardNumber(header[1]);
  const headerWithRest = normalized.match(/^Card\s*#\s*(\d+)\s*:/i);
  if (headerWithRest?.[1]) return normalizeCardNumber(headerWithRest[1]);
  return null;
}

function findFieldLine(
  text: string,
  label: ConfigFieldLabel,
): { line: string; lineNumber: number } | null {
  const lines = normalizeConfigDocText(text).split("\n");
  // Card # supports "Card #: 1" and heading-only "Card #1" forms.
  if (label === "Card #") {
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      if (isCardNumberSectionLine(line) && readCardNumberFromLine(line)) {
        return { line, lineNumber: index + 1 };
      }
    }
    return null;
  }

  const pattern = new RegExp(`^\\s*${escapeRegExp(label)}\\s*:`, "i");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (pattern.test(line)) {
      return { line, lineNumber: index + 1 };
    }
  }
  return null;
}

type FieldValueRead =
  | { ok: true; value: string }
  | { ok: false; reason: "missing" | "unclosed_quote" | "empty_label_line" };

/**
 * Read a field value from Label: "value", Label: value, or smart-quoted forms.
 * If a value starts with `"`, a matching closing quote is required.
 */
function readFieldValueDetailed(
  text: string,
  label: ConfigFieldLabel,
): FieldValueRead {
  if (label === "Card #") {
    const found = findFieldLine(text, label);
    if (!found) return { ok: false, reason: "missing" };
    const value = readCardNumberFromLine(found.line);
    if (value == null) return { ok: false, reason: "empty_label_line" };
    return { ok: true, value };
  }

  const found = findFieldLine(text, label);
  if (!found) return { ok: false, reason: "missing" };

  const match = found.line.match(
    new RegExp(`^\\s*${escapeRegExp(label)}\\s*:\\s*(.*)$`, "i"),
  );
  if (!match) return { ok: false, reason: "missing" };

  const raw = (match[1] ?? "").trim();
  if (raw.startsWith('"')) {
    const quoted = raw.match(/^"([^"]*)"\s*$/);
    if (!quoted) return { ok: false, reason: "unclosed_quote" };
    return { ok: true, value: quoted[1] ?? "" };
  }

  return { ok: true, value: raw };
}

function readFieldValue(text: string, label: ConfigFieldLabel): string | null {
  const result = readFieldValueDetailed(text, label);
  return result.ok ? result.value : null;
}

/**
 * Validate Card Configuration field presence/shape.
 * Accepts quoted values (preferred) and bare values from Google Docs exports.
 */
export function validateDashboardConfigSyntax(text: string): string[] {
  const errors: string[] = [];
  const normalized = normalizeConfigDocText(text);

  for (const label of CONFIG_FIELD_LABELS) {
    const result = readFieldValueDetailed(normalized, label);
    if (result.ok) continue;

    if (result.reason === "missing") {
      errors.push(
        label === "Card #"
          ? 'Syntax error: missing Card #: "value" (also accepts Card #: 1 or Card #1)'
          : `Syntax error: missing ${label}: "value"`,
      );
      continue;
    }

    if (result.reason === "unclosed_quote") {
      const found = findFieldLine(normalized, label);
      errors.push(
        `Syntax error on line ${found?.lineNumber ?? "?"}: ${label} is missing a closing "`,
      );
      continue;
    }

    if (label === "Card #") {
      const found = findFieldLine(normalized, label);
      errors.push(
        `Syntax error on line ${found?.lineNumber ?? "?"}: Card # must be a number like "1"`,
      );
    }
  }

  return errors;
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
 * Accepts `Card #: "1"`, `Card #: 1`, `Card #1`, and smart-quoted Google Doc text.
 */
export function splitCardConfigBlocks(text: string): string[] {
  const lines = normalizeConfigDocText(text).split("\n");
  const blocks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (isCardNumberSectionLine(line) && current.some((entry) => entry.trim())) {
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
 * Card # is the card id (e.g. "1" for Card #1).
 */
export function parseDashboardConfigText(
  text: string,
  base: DashboardConfig = EMPTY_BASE_CONFIG,
): { config: DashboardConfig } | { error: string; errors: string[] } {
  const normalized = normalizeConfigDocText(text);
  const syntaxErrors = validateDashboardConfigSyntax(normalized);
  if (syntaxErrors.length > 0) {
    return { error: syntaxErrors[0] ?? "Syntax error", errors: syntaxErrors };
  }

  const cardNumberRaw = readFieldValue(normalized, "Card #");
  const responsibleEngineer = readFieldValue(normalized, "Responsible Engineer");
  const boardName = readFieldValue(normalized, "Board Name");
  const boardNickname = readFieldValue(normalized, "Board Nickname");
  const googleDriveLink = readFieldValue(normalized, "Google Drive Link");
  const smartsheetLink = readFieldValue(normalized, "Smartsheet Link");

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
  const normalized = normalizeConfigDocText(text);
  const blocks = splitCardConfigBlocks(normalized);
  if (blocks.length === 0) {
    return {
      error:
        'Syntax error: missing Card #: "value". Each card section must start with Card #: "1" (or Card #1).',
      errors: [
        'Syntax error: missing Card #: "value". Each card section must start with Card #: "1" (or Card #1).',
      ],
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
