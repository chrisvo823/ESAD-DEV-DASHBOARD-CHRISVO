export const LOGIN_ACTIVITY_WINDOW_MS = 24 * 60 * 60 * 1000;
export const LOGIN_ACTIVITY_MAX_EVENTS = 500;

export type LoginActivityEvent = {
  email: string;
  at: string; // ISO timestamp
};

/** Unique signed-in user within the rolling 24h window. */
export type LoginActivityUser = {
  email: string;
  lastSeenAt: string;
  signInCount: number;
};

export type LoginActivitySummary = {
  windowHours: number;
  count: number;
  uniqueEmails: number;
  /** Running unique-user list for the last 24 hours (newest last-seen first). */
  users: LoginActivityUser[];
  events: LoginActivityEvent[];
};

/** Collapse events into a running unique-user list (newest last-seen first). */
export function uniqueLoginUsers(
  events: LoginActivityEvent[],
): LoginActivityUser[] {
  const byEmail = new Map<string, LoginActivityUser>();
  for (const event of events) {
    const existing = byEmail.get(event.email);
    if (!existing) {
      byEmail.set(event.email, {
        email: event.email,
        lastSeenAt: event.at,
        signInCount: 1,
      });
      continue;
    }
    existing.signInCount += 1;
    if (Date.parse(event.at) > Date.parse(existing.lastSeenAt)) {
      existing.lastSeenAt = event.at;
    }
  }
  return [...byEmail.values()].sort(
    (a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt),
  );
}

function allowedEmailDomain(): string {
  return (
    process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN?.trim().toLowerCase() ||
    "machindustries.com"
  );
}

export function normalizeLoginEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim().toLowerCase() ?? "";
  if (!trimmed || !trimmed.includes("@")) return null;
  const domain = allowedEmailDomain().replace(/^@/, "");
  if (!trimmed.endsWith(`@${domain}`)) return null;
  return trimmed;
}

export function parseLoginActivityEvent(
  value: unknown,
): LoginActivityEvent | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { email?: unknown; at?: unknown };
  const email = normalizeLoginEmail(
    typeof record.email === "string" ? record.email : null,
  );
  if (!email) return null;
  const at = typeof record.at === "string" ? record.at.trim() : "";
  if (!at || Number.isNaN(Date.parse(at))) return null;
  return { email, at };
}

/** Keep newest-first events inside the rolling window. */
export function filterLoginActivity(
  events: LoginActivityEvent[],
  now: Date = new Date(),
  windowMs: number = LOGIN_ACTIVITY_WINDOW_MS,
): LoginActivityEvent[] {
  const cutoff = now.getTime() - windowMs;
  return events
    .filter((event) => {
      const ms = Date.parse(event.at);
      return Number.isFinite(ms) && ms >= cutoff && ms <= now.getTime() + 60_000;
    })
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, LOGIN_ACTIVITY_MAX_EVENTS);
}

export function summarizeLoginActivity(
  events: LoginActivityEvent[],
  now: Date = new Date(),
): LoginActivitySummary {
  const recent = filterLoginActivity(events, now);
  const users = uniqueLoginUsers(recent);
  return {
    windowHours: 24,
    count: recent.length,
    uniqueEmails: users.length,
    users,
    events: recent,
  };
}

export function formatLoginActivityTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
