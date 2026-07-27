"use client";

import { useEffect, useState } from "react";
import {
  getAdminSessionPassword,
  setAdminAuthenticated,
} from "./admin-auth";
import {
  hydrateSiteConfigFromHost,
  readCachedRecoveryEmail,
  subscribeSiteConfig,
} from "./site-config-client";

/** @deprecated Admin credentials are host-persisted; key kept for migration only. */
export const ADMIN_CREDENTIALS_STORAGE_KEY = "esad-admin-credentials";
export const ADMIN_CREDENTIALS_EVENT = "esad-admin-credentials-change";

export type StoredAdminCredentials = {
  password: string;
  recoveryEmail: string;
};

function emitCredentials(credentials: StoredAdminCredentials) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(ADMIN_CREDENTIALS_EVENT, {
      detail: { credentials },
    }),
  );
}

/** Local view of credentials: password is session-only; recovery email is host-backed. */
export function readAdminCredentials(
  fallbackPassword: string,
): StoredAdminCredentials {
  if (typeof window === "undefined") {
    return { password: fallbackPassword, recoveryEmail: "" };
  }
  return {
    password: getAdminSessionPassword() || fallbackPassword,
    recoveryEmail: readCachedRecoveryEmail(),
  };
}

export function writeAdminCredentials(
  credentials: StoredAdminCredentials,
  fallbackPassword: string,
): StoredAdminCredentials {
  const next = {
    password:
      typeof credentials.password === "string" && credentials.password.length > 0
        ? credentials.password
        : fallbackPassword,
    recoveryEmail:
      typeof credentials.recoveryEmail === "string"
        ? credentials.recoveryEmail.trim()
        : "",
  };
  emitCredentials(next);
  return next;
}

export async function verifyAdminCredentials(options: {
  username: string;
  password: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch("/api/admin-credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "verify",
        username: options.username,
        password: options.password,
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      return { ok: false, error: "Invalid credentials" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reach host admin service." };
  }
}

export async function changeAdminPassword(options: {
  fallbackPassword: string;
  currentPassword: string;
  nextPassword: string;
}): Promise<
  { ok: true; credentials: StoredAdminCredentials } | { ok: false; error: string }
> {
  const sessionPassword =
    getAdminSessionPassword() || options.currentPassword || options.fallbackPassword;
  try {
    const response = await fetch("/api/admin-credentials", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-esad-admin-password": sessionPassword,
      },
      body: JSON.stringify({
        action: "change",
        currentPassword: options.currentPassword,
        nextPassword: options.nextPassword,
      }),
      cache: "no-store",
    });
    const payload = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok || !payload.ok) {
      return {
        ok: false,
        error: payload.error || "Could not change password.",
      };
    }
    setAdminAuthenticated(true, options.nextPassword);
    const credentials = {
      password: options.nextPassword,
      recoveryEmail: readCachedRecoveryEmail(),
    };
    emitCredentials(credentials);
    return { ok: true, credentials };
  } catch {
    return { ok: false, error: "Could not reach host admin service." };
  }
}

export async function resetAdminPassword(options: {
  fallbackPassword: string;
  email: string;
  nextPassword: string;
}): Promise<
  { ok: true; credentials: StoredAdminCredentials } | { ok: false; error: string }
> {
  try {
    const response = await fetch("/api/admin-credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reset",
        email: options.email,
        nextPassword: options.nextPassword,
      }),
      cache: "no-store",
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      error?: string;
      recoveryEmail?: string;
    };
    if (!response.ok || !payload.ok) {
      return {
        ok: false,
        error: payload.error || "Could not reset password.",
      };
    }
    await hydrateSiteConfigFromHost();
    const credentials = {
      password: options.nextPassword,
      recoveryEmail:
        typeof payload.recoveryEmail === "string"
          ? payload.recoveryEmail
          : options.email.trim().toLowerCase(),
    };
    emitCredentials(credentials);
    return { ok: true, credentials };
  } catch {
    return { ok: false, error: "Could not reach host admin service." };
  }
}

export function useAdminCredentials(
  fallbackPassword: string,
): StoredAdminCredentials {
  const [credentials, setCredentials] = useState<StoredAdminCredentials>({
    password: fallbackPassword,
    recoveryEmail: "",
  });

  useEffect(() => {
    let cancelled = false;
    void hydrateSiteConfigFromHost().then(() => {
      if (!cancelled) {
        setCredentials(readAdminCredentials(fallbackPassword));
      }
    });

    const unsubscribe = subscribeSiteConfig(() => {
      setCredentials(readAdminCredentials(fallbackPassword));
    });
    const onLegacy = (event: Event) => {
      const detail = (
        event as CustomEvent<{ credentials: StoredAdminCredentials }>
      ).detail;
      if (detail?.credentials) setCredentials(detail.credentials);
    };
    window.addEventListener(ADMIN_CREDENTIALS_EVENT, onLegacy);

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener(ADMIN_CREDENTIALS_EVENT, onLegacy);
    };
  }, [fallbackPassword]);

  return credentials;
}
