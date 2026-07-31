"use client";

import { useSyncExternalStore } from "react";

export const ADMIN_SESSION_KEY = "esad-admin-authenticated";
export const ADMIN_SESSION_PASSWORD_KEY = "esad-admin-session-password";
export const ADMIN_AUTH_EVENT = "esad-admin-auth-change";

export function isAdminAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(ADMIN_SESSION_KEY) === "1";
}

export function getAdminSessionPassword(): string {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(ADMIN_SESSION_PASSWORD_KEY)?.trim() ?? "";
}

/**
 * Admin-mode gate for Google Drive configuration writes.
 * Drive Docs must only be updated while an Admin session is active.
 */
export function requireAdminSessionForDriveWrite(): string {
  if (!isAdminAuthenticated()) {
    throw new Error(
      "Admin mode is required to write Google Drive configuration files.",
    );
  }
  const password = getAdminSessionPassword();
  if (!password) {
    throw new Error(
      "Admin session required to write Google Drive configuration files.",
    );
  }
  return password;
}

export function setAdminAuthenticated(
  authenticated: boolean,
  sessionPassword?: string,
): void {
  if (typeof window === "undefined") return;
  if (authenticated) {
    window.sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
    if (sessionPassword) {
      window.sessionStorage.setItem(
        ADMIN_SESSION_PASSWORD_KEY,
        sessionPassword,
      );
    }
  } else {
    window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
    window.sessionStorage.removeItem(ADMIN_SESSION_PASSWORD_KEY);
  }
  window.dispatchEvent(
    new CustomEvent(ADMIN_AUTH_EVENT, { detail: { authenticated } }),
  );
}

function subscribeAdminAuth(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  const onChange = () => onStoreChange();
  window.addEventListener(ADMIN_AUTH_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(ADMIN_AUTH_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useAdminAuthenticated(): boolean {
  return useSyncExternalStore(
    subscribeAdminAuth,
    isAdminAuthenticated,
    () => false,
  );
}

export function useAdminSessionPassword(): string {
  return useSyncExternalStore(
    subscribeAdminAuth,
    getAdminSessionPassword,
    () => "",
  );
}
