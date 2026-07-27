import assert from "node:assert/strict";
import test from "node:test";
import {
  filterLoginActivity,
  formatLoginActivityTime,
  normalizeLoginEmail,
  parseLoginActivityEvent,
  summarizeLoginActivity,
  uniqueLoginUsers,
} from "../lib/login-activity.ts";

test("normalizes allowed company emails only", () => {
  assert.equal(
    normalizeLoginEmail("Ops@MachIndustries.com"),
    "ops@machindustries.com",
  );
  assert.equal(normalizeLoginEmail("ops@gmail.com"), null);
  assert.equal(normalizeLoginEmail(""), null);
});

test("filters login events to the last 24 hours", () => {
  const now = new Date("2026-07-27T20:00:00Z");
  const events = [
    { email: "a@machindustries.com", at: "2026-07-27T19:00:00Z" },
    { email: "b@machindustries.com", at: "2026-07-26T19:00:00Z" }, // 25h ago
    { email: "c@machindustries.com", at: "2026-07-27T10:00:00Z" },
  ];
  const recent = filterLoginActivity(events, now);
  assert.deepEqual(
    recent.map((event) => event.email),
    ["a@machindustries.com", "c@machindustries.com"],
  );
});

test("summarizes unique emails and running user list", () => {
  const now = new Date("2026-07-27T20:00:00Z");
  const summary = summarizeLoginActivity(
    [
      { email: "a@machindustries.com", at: "2026-07-27T19:00:00Z" },
      { email: "a@machindustries.com", at: "2026-07-27T18:00:00Z" },
      { email: "b@machindustries.com", at: "2026-07-27T12:00:00Z" },
      { email: "stale@machindustries.com", at: "2026-07-26T18:00:00Z" },
    ],
    now,
  );
  assert.equal(summary.count, 3);
  assert.equal(summary.uniqueEmails, 2);
  assert.equal(summary.windowHours, 24);
  assert.deepEqual(
    summary.users.map((user) => ({
      email: user.email,
      signInCount: user.signInCount,
      lastSeenAt: user.lastSeenAt,
    })),
    [
      {
        email: "a@machindustries.com",
        signInCount: 2,
        lastSeenAt: "2026-07-27T19:00:00Z",
      },
      {
        email: "b@machindustries.com",
        signInCount: 1,
        lastSeenAt: "2026-07-27T12:00:00Z",
      },
    ],
  );
});

test("uniqueLoginUsers collapses duplicates by newest last-seen", () => {
  const users = uniqueLoginUsers([
    { email: "b@machindustries.com", at: "2026-07-27T10:00:00Z" },
    { email: "a@machindustries.com", at: "2026-07-27T12:00:00Z" },
    { email: "a@machindustries.com", at: "2026-07-27T11:00:00Z" },
  ]);
  assert.deepEqual(
    users.map((user) => user.email),
    ["a@machindustries.com", "b@machindustries.com"],
  );
  assert.equal(users[0]?.signInCount, 2);
});

test("parses and rejects invalid login events", () => {
  assert.equal(parseLoginActivityEvent(null), null);
  assert.equal(
    parseLoginActivityEvent({
      email: "ops@machindustries.com",
      at: "not-a-date",
    }),
    null,
  );
  assert.deepEqual(
    parseLoginActivityEvent({
      email: "Ops@machindustries.com",
      at: "2026-07-27T12:00:00.000Z",
    }),
    {
      email: "ops@machindustries.com",
      at: "2026-07-27T12:00:00.000Z",
    },
  );
  assert.match(formatLoginActivityTime("2026-07-27T12:00:00.000Z"), /Jul/);
});
