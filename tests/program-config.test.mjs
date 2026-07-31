import assert from "node:assert/strict";
import test from "node:test";
import {
  CARD_LED_THRESHOLD_SECTION,
  DEFAULT_PROGRAM_CONFIG,
  combineProgramConfigEditors,
  formatProgramConfigText,
  formatProgramIdentityText,
  formatProgramLedThresholdText,
  metricDisplayLabel,
  overdueThresholdsFromProgramConfig,
  parseProgramConfigText,
  resetProgramConfigQuotedValues,
  validateProgramConfigSyntax,
} from "../lib/program-config.ts";
import { statusFromOverdueCount } from "../lib/dsb-tasks.ts";

const SAMPLE_IDENTITY = {
  ...DEFAULT_PROGRAM_CONFIG,
  dashboardName: "Test Dashboard",
  programLead: "Test Program Lead",
};

const SAMPLE_IDENTITY_LINES = [
  'Dashboard Name: "Test Dashboard"',
  'Program Lead: "Test Program Lead"',
  'Open Tasks: "Open Tasks"',
  'Over Due: "Over Due"',
  'Current Task: "Current Task"',
  'Next Task: "Next Task"',
];

test("defaults leave dashboard identity empty for Google Drive Dashboard Configuration", () => {
  assert.equal(DEFAULT_PROGRAM_CONFIG.dashboardName, "");
  assert.equal(DEFAULT_PROGRAM_CONFIG.programLead, "");
});

test("formats Dashboard Configuration text with metric labels and LED section", () => {
  assert.equal(
    formatProgramIdentityText(SAMPLE_IDENTITY),
    SAMPLE_IDENTITY_LINES.join("\n"),
  );
  assert.equal(
    formatProgramLedThresholdText(SAMPLE_IDENTITY),
    [
      "Card LED Threshold Configuration:",
      'Green: "1"',
      'Yellow: "3"',
      'Red: "5"',
    ].join("\n"),
  );
  assert.equal(
    formatProgramConfigText(SAMPLE_IDENTITY),
    [
      ...SAMPLE_IDENTITY_LINES,
      "",
      "Card LED Threshold Configuration:",
      'Green: "1"',
      'Yellow: "3"',
      'Red: "5"',
    ].join("\n"),
  );
  assert.equal(CARD_LED_THRESHOLD_SECTION, "Card LED Threshold Configuration:");
  assert.deepEqual(overdueThresholdsFromProgramConfig(SAMPLE_IDENTITY), {
    greenAtMost: 1,
    yellowAtLeast: 3,
    redAtLeast: 5,
  });
});

test("combines identity and LED editors for parsing", () => {
  const combined = combineProgramConfigEditors(
    formatProgramIdentityText(SAMPLE_IDENTITY),
    formatProgramLedThresholdText(SAMPLE_IDENTITY),
  );
  const parsed = parseProgramConfigText(combined);
  assert.ok("config" in parsed);
  assert.equal(parsed.config.ledGreenAtMost, 1);
  assert.equal(parsed.config.ledYellowAtLeast, 3);
  assert.equal(parsed.config.ledRedAtLeast, 5);
  assert.equal(parsed.config.dashboardName, "Test Dashboard");
  assert.equal(parsed.config.programLead, "Test Program Lead");
  assert.equal(parsed.config.openTasksLabel, "Open Tasks");
  assert.equal(parsed.config.overDueLabel, "Over Due");
  assert.equal(parsed.config.currentTaskLabel, "Current Task");
  assert.equal(parsed.config.nextTaskLabel, "Next Task");
});

test("reset clears Dashboard Configuration values inside quotes but keeps LED section header", () => {
  const identity = formatProgramIdentityText(SAMPLE_IDENTITY);
  const led = formatProgramLedThresholdText(SAMPLE_IDENTITY);
  assert.equal(
    resetProgramConfigQuotedValues(identity),
    [
      'Dashboard Name: ""',
      'Program Lead: ""',
      'Open Tasks: ""',
      'Over Due: ""',
      'Current Task: ""',
      'Next Task: ""',
    ].join("\n"),
  );
  assert.equal(
    resetProgramConfigQuotedValues(led),
    [
      "Card LED Threshold Configuration:",
      'Green: ""',
      'Yellow: ""',
      'Red: ""',
    ].join("\n"),
  );
});

test("parses Dashboard Configuration text including metric labels and LED thresholds", () => {
  const text = [
    'Dashboard Name: "ESAD Avionics Dashboard"',
    'Program Lead: "Long Nguyen"',
    'Open Tasks: "Open Work"',
    'Over Due: "Past Due"',
    'Current Task: "Active Task"',
    'Next Task: "Upcoming Task"',
    "",
    "Card LED Threshold Configuration:",
    'Green: "2"',
    'Yellow: "4"',
    'Red: "9"',
  ].join("\n");
  const parsed = parseProgramConfigText(text);
  assert.ok("config" in parsed);
  assert.equal(parsed.config.dashboardName, "ESAD Avionics Dashboard");
  assert.equal(parsed.config.programLead, "Long Nguyen");
  assert.equal(parsed.config.openTasksLabel, "Open Work");
  assert.equal(parsed.config.overDueLabel, "Past Due");
  assert.equal(parsed.config.currentTaskLabel, "Active Task");
  assert.equal(parsed.config.nextTaskLabel, "Upcoming Task");
  assert.equal(parsed.config.ledGreenAtMost, 2);
  assert.equal(parsed.config.ledYellowAtLeast, 4);
  assert.equal(parsed.config.ledRedAtLeast, 9);
});

test("metricDisplayLabel uses editable Dashboard Configuration text", () => {
  assert.equal(
    metricDisplayLabel("Open Tasks", {
      openTasksLabel: "Open Work",
      overDueLabel: "Past Due",
      currentTaskLabel: "Active Task",
      nextTaskLabel: "Upcoming Task",
    }),
    "Open Work",
  );
  assert.equal(
    metricDisplayLabel("Next Task", SAMPLE_IDENTITY),
    "Next Task",
  );
});

test("quoted LED thresholds drive card status LED color", () => {
  const text = [
    ...SAMPLE_IDENTITY_LINES,
    "Card LED Threshold Configuration:",
    'Green: "1"',
    'Yellow: "2"',
    'Red: "5"',
  ].join("\n");
  const parsed = parseProgramConfigText(text);
  assert.ok("config" in parsed);
  const thresholds = overdueThresholdsFromProgramConfig(parsed.config);
  assert.equal(statusFromOverdueCount(0, thresholds), "On Track");
  assert.equal(statusFromOverdueCount(1, thresholds), "On Track");
  assert.equal(statusFromOverdueCount(2, thresholds), "Delayed");
  assert.equal(statusFromOverdueCount(4, thresholds), "Delayed");
  assert.equal(statusFromOverdueCount(5, thresholds), "At Risk");
});

test("accepts legacy operator LED threshold syntax when parsing", () => {
  const text = [
    ...SAMPLE_IDENTITY_LINES,
    "Card LED Threshold Configuration:",
    'Green: "< 1"',
    'Yellow: "> 2"',
    'Red: "> 5"',
  ].join("\n");
  const parsed = parseProgramConfigText(text);
  assert.ok("config" in parsed);
  assert.equal(parsed.config.ledGreenAtMost, 1);
  assert.equal(parsed.config.ledYellowAtLeast, 2);
  assert.equal(parsed.config.ledRedAtLeast, 5);
});

test("accepts bare and smart-quoted Dashboard Configuration values", () => {
  const text = [
    "Dashboard Name: ESAD Avionics Dashboard",
    "Program Lead: \u201CLong Nguyen\u201D",
    "Open Tasks: Open Work",
    "Over Due: Past Due",
    "Current Task: Active Task",
    "Next Task: Upcoming Task",
    "Card LED Threshold Configuration:",
    "Green: 2",
    "Yellow: 4",
    "Red: 9",
  ].join("\n");
  const errors = validateProgramConfigSyntax(text);
  assert.deepEqual(errors, []);
  const parsed = parseProgramConfigText(text);
  assert.ok("config" in parsed);
  assert.equal(parsed.config.dashboardName, "ESAD Avionics Dashboard");
  assert.equal(parsed.config.programLead, "Long Nguyen");
  assert.equal(parsed.config.ledGreenAtMost, 2);
  assert.equal(parsed.config.ledYellowAtLeast, 4);
  assert.equal(parsed.config.ledRedAtLeast, 9);
});

test("flags invalid LED threshold syntax in Dashboard Configuration", () => {
  const text = [
    ...SAMPLE_IDENTITY_LINES,
    "Card LED Threshold Configuration:",
    'Green: "one"',
    'Yellow: "2"',
    'Red: "5"',
  ].join("\n");
  const errors = validateProgramConfigSyntax(text);
  assert.ok(errors.some((error) => /Green must use Green: "N"/i.test(error)));
});

test("flags missing closing quote for Program Lead", () => {
  const text = [
    'Dashboard Name: "Test Dashboard"',
    'Program Lead: "Test Program Lead',
    'Open Tasks: "Open Tasks"',
    'Over Due: "Over Due"',
    'Current Task: "Current Task"',
    'Next Task: "Next Task"',
    "Card LED Threshold Configuration:",
    'Green: "1"',
    'Yellow: "2"',
    'Red: "5"',
  ].join("\n");
  const errors = validateProgramConfigSyntax(text);
  assert.ok(errors.some((error) => /missing a closing "/i.test(error)));
});

test("flags missing metric label fields in Dashboard Configuration", () => {
  const text = [
    'Dashboard Name: "Test Dashboard"',
    'Program Lead: "Test Program Lead"',
    "Card LED Threshold Configuration:",
    'Green: "1"',
    'Yellow: "2"',
    'Red: "5"',
  ].join("\n");
  const errors = validateProgramConfigSyntax(text);
  assert.ok(errors.some((error) => /missing Open Tasks/i.test(error)));
  assert.ok(errors.some((error) => /missing Next Task/i.test(error)));
});
