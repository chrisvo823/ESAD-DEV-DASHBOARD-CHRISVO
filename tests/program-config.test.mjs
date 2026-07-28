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
  validateProgramConfigSyntax,
} from "../lib/program-config.ts";
import { statusFromOverdueCount } from "../lib/dsb-tasks.ts";

const DEFAULT_IDENTITY_LINES = [
  'Dashboard Name: "MACH ESAD Development Dashboard"',
  'Program Lead: "Engineering Program Office"',
  'Open Tasks: "Open Tasks"',
  'Over Due: "Over Due"',
  'Current Task: "Current Task"',
  'Next Task: "Next Task"',
];

test("formats Dashboard Configuration text with metric labels and LED section", () => {
  assert.equal(
    formatProgramIdentityText(DEFAULT_PROGRAM_CONFIG),
    DEFAULT_IDENTITY_LINES.join("\n"),
  );
  assert.equal(
    formatProgramLedThresholdText(DEFAULT_PROGRAM_CONFIG),
    [
      "Card LED Threshold Configuration:",
      'Green: "1"',
      'Yellow: "3"',
      'Red: "5"',
    ].join("\n"),
  );
  assert.equal(
    formatProgramConfigText(DEFAULT_PROGRAM_CONFIG),
    [
      ...DEFAULT_IDENTITY_LINES,
      "",
      "Card LED Threshold Configuration:",
      'Green: "1"',
      'Yellow: "3"',
      'Red: "5"',
    ].join("\n"),
  );
  assert.equal(CARD_LED_THRESHOLD_SECTION, "Card LED Threshold Configuration:");
  assert.deepEqual(overdueThresholdsFromProgramConfig(DEFAULT_PROGRAM_CONFIG), {
    greenAtMost: 1,
    yellowAtLeast: 3,
    redAtLeast: 5,
  });
});

test("combines identity and LED editors for parsing", () => {
  const combined = combineProgramConfigEditors(
    formatProgramIdentityText(DEFAULT_PROGRAM_CONFIG),
    formatProgramLedThresholdText(DEFAULT_PROGRAM_CONFIG),
  );
  const parsed = parseProgramConfigText(combined);
  assert.ok("config" in parsed);
  assert.equal(parsed.config.ledGreenAtMost, 1);
  assert.equal(parsed.config.ledYellowAtLeast, 3);
  assert.equal(parsed.config.ledRedAtLeast, 5);
  assert.equal(parsed.config.openTasksLabel, "Open Tasks");
  assert.equal(parsed.config.overDueLabel, "Over Due");
  assert.equal(parsed.config.currentTaskLabel, "Current Task");
  assert.equal(parsed.config.nextTaskLabel, "Next Task");
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
    metricDisplayLabel("Next Task", DEFAULT_PROGRAM_CONFIG),
    "Next Task",
  );
});

test("quoted LED thresholds drive card status LED color", () => {
  const text = [
    ...DEFAULT_IDENTITY_LINES,
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
    ...DEFAULT_IDENTITY_LINES,
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

test("flags syntax errors when Dashboard Configuration values are unquoted", () => {
  const text = [
    "Dashboard Name: MACH ESAD Development Dashboard",
    'Program Lead: "Engineering Program Office"',
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
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Dashboard Name value must be inside " "/);
});

test("flags invalid LED threshold syntax in Dashboard Configuration", () => {
  const text = [
    ...DEFAULT_IDENTITY_LINES,
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
    'Dashboard Name: "MACH ESAD Development Dashboard"',
    'Program Lead: "Engineering Program Office',
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
    'Dashboard Name: "MACH ESAD Development Dashboard"',
    'Program Lead: "Engineering Program Office"',
    "Card LED Threshold Configuration:",
    'Green: "1"',
    'Yellow: "2"',
    'Red: "5"',
  ].join("\n");
  const errors = validateProgramConfigSyntax(text);
  assert.ok(errors.some((error) => /missing Open Tasks/i.test(error)));
  assert.ok(errors.some((error) => /missing Next Task/i.test(error)));
});
