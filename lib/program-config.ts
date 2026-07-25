import {
  DEFAULT_OVERDUE_LED_THRESHOLDS,
  type OverdueLedThresholds,
} from "./dsb-tasks.ts";

/** Top-level dashboard title / program lead shown in the hero header. */
export type ProgramConfig = {
  dashboardName: string;
  programLead: string;
  /** On Track when Over Due count is &lt; this value. */
  ledGreenLessThan: number;
  /** Delayed when Over Due count is &gt; this value (and not red). */
  ledYellowGreaterThan: number;
  /** At Risk when Over Due count is &gt; this value. */
  ledRedGreaterThan: number;
};

export const DEFAULT_PROGRAM_CONFIG: ProgramConfig = {
  dashboardName: "MACH ESAD Development Dashboard",
  programLead: "Engineering Program Office",
  ledGreenLessThan: DEFAULT_OVERDUE_LED_THRESHOLDS.greenLessThan,
  ledYellowGreaterThan: DEFAULT_OVERDUE_LED_THRESHOLDS.yellowGreaterThan,
  ledRedGreaterThan: DEFAULT_OVERDUE_LED_THRESHOLDS.redGreaterThan,
};

export function overdueThresholdsFromProgramConfig(
  config: Pick<
    ProgramConfig,
    "ledGreenLessThan" | "ledYellowGreaterThan" | "ledRedGreaterThan"
  >,
): OverdueLedThresholds {
  return {
    greenLessThan: config.ledGreenLessThan,
    yellowGreaterThan: config.ledYellowGreaterThan,
    redGreaterThan: config.ledRedGreaterThan,
  };
}

export function withDefaultProgramLedThresholds<
  T extends Partial<ProgramConfig>,
>(
  config: T,
): T & {
  ledGreenLessThan: number;
  ledYellowGreaterThan: number;
  ledRedGreaterThan: number;
} {
  return {
    ...config,
    ledGreenLessThan:
      typeof config.ledGreenLessThan === "number" &&
      Number.isFinite(config.ledGreenLessThan)
        ? config.ledGreenLessThan
        : DEFAULT_OVERDUE_LED_THRESHOLDS.greenLessThan,
    ledYellowGreaterThan:
      typeof config.ledYellowGreaterThan === "number" &&
      Number.isFinite(config.ledYellowGreaterThan)
        ? config.ledYellowGreaterThan
        : DEFAULT_OVERDUE_LED_THRESHOLDS.yellowGreaterThan,
    ledRedGreaterThan:
      typeof config.ledRedGreaterThan === "number" &&
      Number.isFinite(config.ledRedGreaterThan)
        ? config.ledRedGreaterThan
        : DEFAULT_OVERDUE_LED_THRESHOLDS.redGreaterThan,
  };
}

export const PROGRAM_CONFIG_FIELD_LABELS = [
  "Dashboard Name",
  "Program Lead",
  "Green",
  "Yellow",
  "Red",
] as const;

export type ProgramConfigFieldLabel =
  (typeof PROGRAM_CONFIG_FIELD_LABELS)[number];

const LED_FIELD_OPS = {
  Green: "<",
  Yellow: ">",
  Red: ">",
} as const;

type LedFieldLabel = keyof typeof LED_FIELD_OPS;

function isLedFieldLabel(label: ProgramConfigFieldLabel): label is LedFieldLabel {
  return label === "Green" || label === "Yellow" || label === "Red";
}

export function formatLedThresholdValue(
  op: "<" | ">",
  value: number,
): string {
  return `${op} ${value}`;
}

/** Section header shown above editable LED threshold fields. */
export const CARD_LED_THRESHOLD_SECTION =
  "Card LED Threshold Configuration:";

/** Dashboard Name + Program Lead lines for the identity editor. */
export function formatProgramIdentityText(config: ProgramConfig): string {
  return [
    `Dashboard Name: "${config.dashboardName}"`,
    `Program Lead: "${config.programLead}"`,
  ].join("\n");
}

/** Card LED Threshold Configuration block for the LED editor. */
export function formatProgramLedThresholdText(config: ProgramConfig): string {
  return [
    CARD_LED_THRESHOLD_SECTION,
    `Green: "${formatLedThresholdValue("<", config.ledGreenLessThan)}"`,
    `Yellow: "${formatLedThresholdValue(">", config.ledYellowGreaterThan)}"`,
    `Red: "${formatLedThresholdValue(">", config.ledRedGreaterThan)}"`,
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

function parseLedThresholdRaw(
  raw: string,
  expectedOp: "<" | ">",
): number | null {
  const match = raw.trim().match(/^(<|>)\s*(\d+)$/);
  if (!match) return null;
  if (match[1] !== expectedOp) return null;
  return Number(match[2]);
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
        const expectedOp = LED_FIELD_OPS[label];
        if (parseLedThresholdRaw(quoted[1] ?? "", expectedOp) == null) {
          errors.push(
            `Syntax error on line ${lineNumber}: ${label} must use ${label}: "${expectedOp} N"`,
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
  const greenRaw = readQuotedField(text, "Green");
  const yellowRaw = readQuotedField(text, "Yellow");
  const redRaw = readQuotedField(text, "Red");
  if (
    dashboardName == null ||
    programLead == null ||
    greenRaw == null ||
    yellowRaw == null ||
    redRaw == null
  ) {
    return {
      error: 'Syntax error: each field must use Label: "value"',
      errors: ['Syntax error: each field must use Label: "value"'],
    };
  }

  const ledGreenLessThan = parseLedThresholdRaw(greenRaw, "<");
  const ledYellowGreaterThan = parseLedThresholdRaw(yellowRaw, ">");
  const ledRedGreaterThan = parseLedThresholdRaw(redRaw, ">");

  const valueErrors: string[] = [];
  if (!dashboardName.trim()) {
    valueErrors.push("Dashboard Name cannot be empty.");
  }
  if (!programLead.trim()) {
    valueErrors.push("Program Lead cannot be empty.");
  }
  if (
    ledGreenLessThan == null ||
    ledYellowGreaterThan == null ||
    ledRedGreaterThan == null
  ) {
    valueErrors.push(
      'LED thresholds must use Green: "< N", Yellow: "> N", Red: "> N".',
    );
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
      ledGreenLessThan: ledGreenLessThan!,
      ledYellowGreaterThan: ledYellowGreaterThan!,
      ledRedGreaterThan: ledRedGreaterThan!,
    },
  };
}
