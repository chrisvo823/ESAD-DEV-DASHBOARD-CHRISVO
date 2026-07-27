"use client";

const SESSION_KEY_PREFIX = "esad-login-recorded:";

/** Record an allowed Google sign-in for the Admin Logins (last 24h) view. */
export async function recordDashboardLogin(
  email: string | null | undefined,
): Promise<void> {
  const trimmed = email?.trim().toLowerCase() ?? "";
  if (!trimmed || typeof window === "undefined") return;

  const sessionKey = `${SESSION_KEY_PREFIX}${trimmed}`;
  if (window.sessionStorage.getItem(sessionKey) === "1") return;

  try {
    const response = await fetch("/api/login-activity", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: trimmed }),
    });
    if (response.ok || response.status === 201) {
      window.sessionStorage.setItem(sessionKey, "1");
    }
  } catch {
    // Best-effort — offline / API failure should not block sign-in.
  }
}
