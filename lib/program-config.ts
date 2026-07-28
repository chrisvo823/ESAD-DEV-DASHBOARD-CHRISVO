import {
  DEFAULT_OVERDUE_LED_THRESHOLDS,
  type OverdueLedThresholds,
} from "./dsb-tasks";

/** Stable metric ids used in card data / logic (not the editable display text). */
export const METRIC_KEYS = {
  openTasks: "Open Tasks",
  overDue: "Over Due",
  currentTask: "Current Task",
  nextTask: "Next Task",
} as const;

export type MetricKey = (typeof METRIC_KEYS)[keyof typeof METRIC_KEYS];

/** Top-level dashboard title / program lead shown in the hero header. */
export type ProgramConfig = {
  dashboardName: string;
  programLead: string;
  /** Display label for the Open Tasks metric row. */
  openTasksLabel: string;
  /** Display label for the Over Due metric row. */
  overDueLabel: string;
  /** Display label for the Current Task metric row. */
  currentTaskLabel: string;
  /** Display label for the Next Task metric row. */
  nextTaskLabel: string;
  /** Documented green cutoff shown in Dashboard Configuration. */
  ledGreenAtMost: number;
  /** Delayed / Yellow when Over Due count is ≥ this value (and not red). */
  ledYellowAtLeast: number;
  /** At Risk / Red when Over Due count is ≥ this value. */
  ledRedAtLeast: number;
};

export const DEFAULT_PROGRAM_CONFIG: ProgramConfig = {
  // Identity comes from host Dashboard Configuration — not compiled-in copy.
  dashboardName: "",
  programLead: "",
  openTasksLabel: METRIC_KEYS.openTasks,
  overDueLabel: METRIC_KEYS.overDue,
  currentTaskLabel: METRIC_KEYS.currentTask,
  nextTaskLabel: METRIC_KEYS.nextTask,
  ledGreenAtMost: DEFAULT_OVERDUE_LED_THRESHOLDS.greenAtMost,
  ledYellowAtLeast: DEFAULT_OVERDUE_LED_THRESHOLDS.yellowAtLeast,
  ledRedAtLeast: DEFAULT_OVERDUE_LED_THRESHOLDS.redAtLeast,
};

export function overdueThresholdsFromProgramConfig(
  config: Pick<
    ProgramConfig,
    "ledGreenAtMost" | "ledYellowAtLeast" | "ledRedAtLeast"
  >,
): OverdueLedThresholds {
  return {
    greenAtMost: config.ledGreenAtMost,
    yellowAtLeast: config.ledYellowAtLeast,
    redAtLeast: config.ledRedAtLeast,
  };
}

/** Resolve editable display text for a stable metric key. */
export function metricDisplayLabel(
  metricKey: string,
  config: Pick<
    ProgramConfig,
    | "openTasksLabel"
    | "overDueLabel"
    | "currentTaskLabel"
    | "nextTaskLabel"
  >,
): string {
  switch (metricKey) {
    case METRIC_KEYS.openTasks:
      return config.openTasksLabel;
    case METRIC_KEYS.overDue:
      return config.overDueLabel;
    case METRIC_KEYS.currentTask:
      return config.currentTaskLabel;
    case METRIC_KEYS.nextTask:
      return config.nextTaskLabel;
    default:
      return metricKey;
  }
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readLabel(
  value: unknown,
  fallback: string,
): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function withDefaultProgramMetricLabels<
  T extends Partial<ProgramConfig>,
>(
  config: T,
): T & {
  openTasksLabel: string;
  overDueLabel: string;
  currentTaskLabel: string;
  nextTaskLabel: string;
} {
  return {
    ...config,
    openTasksLabel: readLabel(
      config.openTasksLabel,
      DEFAULT_PROGRAM_CONFIG.openTasksLabel,
    ),
    overDueLabel: readLabel(
      config.overDueLabel,
      DEFAULT_PROGRAM_CONFIG.overDueLabel,
    ),
    currentTaskLabel: readLabel(
      config.currentTaskLabel,
      DEFAULT_PROGRAM_CONFIG.currentTaskLabel,
    ),
    nextTaskLabel: readLabel(
      config.nextTaskLabel,
      DEFAULT_PROGRAM_CONFIG.nextTaskLabel,
    ),
  };
}

export function withDefaultProgramLedThresholds<
  T extends Partial<ProgramConfig> & {
    /** @deprecated legacy key */
    ledGreenLessThan?: number;
    /** @deprecated legacy key */
    ledYellowGreaterThan?: number;
    /** @deprecated legacy key */
    ledRedGreaterThan?: number;
  },
>(
  config: T,
): T & {
  openTasksLabel: string;
  overDueLabel: string;
  currentTaskLabel: string;
  nextTaskLabel: string;
  ledGreenAtMost: number;
  ledYellowAtLeast: number;
  ledRedAtLeast: number;
} {
  const withLabels = withDefaultProgramMetricLabels(config);
  return {
    ...withLabels,
    ledGreenAtMost:
      readFiniteNumber(config.ledGreenAtMost) ??
      readFiniteNumber(config.ledGreenLessThan) ??
      DEFAULT_OVERDUE_LED_THRESHOLDS.greenAtMost,
    ledYellowAtLeast:
      readFiniteNumber(config.ledYellowAtLeast) ??
      readFiniteNumber(config.ledYellowGreaterThan) ??
      DEFAULT_OVERDUE_LED_THRESHOLDS.yellowAtLeast,
    ledRedAtLeast:
      readFiniteNumber(config.ledRedAtLeast) ??
      readFiniteNumber(config.ledRedGreaterThan) ??
      DEFAULT_OVERDUE_LED_THRESHOLDS.redAtLeast,
  };
}

export const PROGRAM_CONFIG_FIELD_LABELS = [
  "Dashboard Name",
  "Program Lead",
  "Open Tasks",
  "Over Due",
  "Current Task",
  "Next Task",
  "Green",
  "Yellow",
  "Red",
] as const;

export type ProgramConfigFieldLabel =
  (typeof PROGRAM_CONFIG_FIELD_LABELS)[number];

function isLedFieldLabel(
  label: ProgramConfigFieldLabel,
): label is "Green" | "Yellow" | "Red" {
  return label === "Green" || label === "Yellow" || label === "Red";
}

/** Section header shown above editable LED threshold fields. */
export const CARD_LED_THRESHOLD_SECTION =
  "Card LED Threshold Configuration:";

/** Dashboard Name, Program Lead, and metric label lines for the identity editor. */
export function formatProgramIdentityText(config: ProgramConfig): string {
  return [
    `Dashboard Name: "${config.dashboardName}"`,
    `Program Lead: "${config.programLead}"`,
    `Open Tasks: "${config.openTasksLabel}"`,
    `Over Due: "${config.overDueLabel}"`,
    `Current Task: "${config.currentTaskLabel}"`,
    `Next Task: "${config.nextTaskLabel}"`,
  ].join("\n");
}

/** Card LED Threshold Configuration block for the LED editor. */
export function formatProgramLedThresholdText(config: ProgramConfig): string {
  return [
    CARD_LED_THRESHOLD_SECTION,
    `Green: "${config.ledGreenAtMost}"`,
    `Yellow: "${config.ledYellowAtLeast}"`,
    `Red: "${config.ledRedAtLeast}"`,
  ].join("\n");
}

export function formatProgramConfigText(config: ProgramConfig): string {
  return [
    formatProgramIdentityText(config),
    "",
    formatProgramLedThresholdText(config),
  ].join("\n");
}

/** Combine the two Dashboard Configuration editors into one parseable text blob. */
export function combineProgramConfigEditors(
  identityText: string,
  ledText: string,
): string {
  return `${identityText.trimEnd()}\n\n${ledText.trim()}\n`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findFieldLine(
  text: string,
  label: ProgramConfigFieldLabel,
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
 * Parse an LED threshold count from a quoted value.
 * Accepts plain counts ("1") and legacy operator forms ("&lt; 1", "&gt; 2").
 */
export function parseLedThresholdCount(raw: string): number | null {
  const trimmed = raw.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const legacy = trimmed.match(/^(<|>)\s*(\d+)$/);
  if (legacy) return Number(legacy[2]);
  return null;
}

/** Validate Dashboard Configuration quote syntax. */
export function validateProgramConfigSyntax(text: string): string[] {
  const errors: string[] = [];

  for (const label of PROGRAM_CONFIG_FIELD_LABELS) {
    const found = findFieldLine(text, label);
    if (!found) {
      errors.push(`Syntax error: missing ${label}: "value"`);
      continue;
    }

    const { line, lineNumber } = found;
    const quoted = line.match(
      new RegExp(`^\\s*${escapeRegExp(label)}\\s*:\\s*"([^"]*)"\\s*$`, "i"),
    );
    if (quoted) {
      if (isLedFieldLabel(label)) {
        if (parseLedThresholdCount(quoted[1] ?? "") == null) {
          errors.push(
            `Syntax error on line ${lineNumber}: ${label} must use ${label}: "N"`,
          );
        }
      }
      continue;
    }

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

function readQuotedField(
  text: string,
  label: ProgramConfigFieldLabel,
): string | null {
  const found = findFieldLine(text, label);
  if (!found) return null;
  const match = found.line.match(
    new RegExp(`^\\s*${escapeRegExp(label)}\\s*:\\s*"([^"]*)"\\s*$`, "i"),
  );
  return match ? match[1] : null;
}

export function parseProgramConfigText(
  text: string,
): { config: ProgramConfig } | { error: string; errors: string[] } {
  const syntaxErrors = validateProgramConfigSyntax(text);
  if (syntaxErrors.length > 0) {
    return { error: syntaxErrors[0] ?? "Syntax error", errors: syntaxErrors };
  }

  const dashboardName = readQuotedField(text, "Dashboard Name");
  const programLead = readQuotedField(text, "Program Lead");
  const openTasksLabel = readQuotedField(text, "Open Tasks");
  const overDueLabel = readQuotedField(text, "Over Due");
  const currentTaskLabel = readQuotedField(text, "Current Task");
  const nextTaskLabel = readQuotedField(text, "Next Task");
  const greenRaw = readQuotedField(text, "Green");
  const yellowRaw = readQuotedField(text, "Yellow");
  const redRaw = readQuotedField(text, "Red");
  if (
    dashboardName == null ||
    programLead == null ||
    openTasksLabel == null ||
    overDueLabel == null ||
    currentTaskLabel == null ||
    nextTaskLabel == null ||
    greenRaw == null ||
    yellowRaw == null ||
    redRaw == null
  ) {
    return {
      error: 'Syntax error: each field must use Label: "value"',
      errors: ['Syntax error: each field must use Label: "value"'],
    };
  }

  const ledGreenAtMost = parseLedThresholdCount(greenRaw);
  const ledYellowAtLeast = parseLedThresholdCount(yellowRaw);
  const ledRedAtLeast = parseLedThresholdCount(redRaw);

  const valueErrors: string[] = [];
  if (!dashboardName.trim()) {
    valueErrors.push("Dashboard Name cannot be empty.");
  }
  if (!programLead.trim()) {
    valueErrors.push("Program Lead cannot be empty.");
  }
  if (!openTasksLabel.trim()) {
    valueErrors.push("Open Tasks label cannot be empty.");
  }
  if (!overDueLabel.trim()) {
    valueErrors.push("Over Due label cannot be empty.");
  }
  if (!currentTaskLabel.trim()) {
    valueErrors.push("Current Task label cannot be empty.");
  }
  if (!nextTaskLabel.trim()) {
    valueErrors.push("Next Task label cannot be empty.");
  }
  if (
    ledGreenAtMost == null ||
    ledYellowAtLeast == null ||
    ledRedAtLeast == null
  ) {
    valueErrors.push('LED thresholds must use Green: "N", Yellow: "N", Red: "N".');
  }
  if (valueErrors.length > 0) {
    return {
      error: valueErrors[0] ?? "Invalid configuration",
      errors: valueErrors,
    };
  }

  return {
    config: {
      dashboardName: dashboardName.trim(),
      programLead: programLead.trim(),
      openTasksLabel: openTasksLabel.trim(),
      overDueLabel: overDueLabel.trim(),
      currentTaskLabel: currentTaskLabel.trim(),
      nextTaskLabel: nextTaskLabel.trim(),
      ledGreenAtMost: ledGreenAtMost!,
      ledYellowAtLeast: ledYellowAtLeast!,
      ledRedAtLeast: ledRedAtLeast!,
    },
  };
}
