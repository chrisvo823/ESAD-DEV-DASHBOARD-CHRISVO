export const LOGIN_ACTIVITY_WINDOW_MS = 24 * 60 * 60 * 1000;
export const LOGIN_ACTIVITY_MAX_EVENTS = 500;

export type LoginActivityEvent = {
  email: string;
  at: string; // ISO timestamp
};

export type LoginActivitySummary = {
  windowHours: number;
  count: number;
  uniqueEmails: number;
  events: LoginActivityEvent[];
};

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
  const uniqueEmails = new Set(recent.map((event) => event.email)).size;
  return {
    windowHours: 24,
    count: recent.length,
    uniqueEmails,
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
