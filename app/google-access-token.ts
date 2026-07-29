"use client";

const GOOGLE_ACCESS_TOKEN_KEY = "esad-google-access-token";

/** Persist the Google OAuth access token from Firebase Google sign-in. */
export function setGoogleAccessToken(token: string | null | undefined): void {
  if (typeof window === "undefined") return;
  const trimmed = token?.trim();
  if (!trimmed) {
    window.sessionStorage.removeItem(GOOGLE_ACCESS_TOKEN_KEY);
    return;
  }
  window.sessionStorage.setItem(GOOGLE_ACCESS_TOKEN_KEY, trimmed);
}

/** Google OAuth access token for Docs API calls (may be empty after reload). */
export function getGoogleAccessToken(): string {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(GOOGLE_ACCESS_TOKEN_KEY)?.trim() ?? "";
}
