"use client";

import { useEffect, useState } from "react";

export const ADMIN_CREDENTIALS_STORAGE_KEY = "esad-admin-credentials";
export const ADMIN_CREDENTIALS_EVENT = "esad-admin-credentials-change";

export type StoredAdminCredentials = {
  password: string;
  recoveryEmail: string;
};

function sanitize(
  raw: unknown,
  fallbackPassword: string,
): StoredAdminCredentials {
  if (!raw || typeof raw !== "object") {
    return { password: fallbackPassword, recoveryEmail: "" };
  }
  const entry = raw as Partial<StoredAdminCredentials>;
  return {
    password:
      typeof entry.password === "string" && entry.password.length > 0
        ? entry.password
        : fallbackPassword,
    recoveryEmail:
      typeof entry.recoveryEmail === "string"
        ? entry.recoveryEmail.trim()
        : "",
  };
}

export function readAdminCredentials(
  fallbackPassword: string,
): StoredAdminCredentials {
  if (typeof window === "undefined") {
    return { password: fallbackPassword, recoveryEmail: "" };
  }
  try {
    const raw = window.localStorage.getItem(ADMIN_CREDENTIALS_STORAGE_KEY);
    if (!raw) return { password: fallbackPassword, recoveryEmail: "" };
    return sanitize(JSON.parse(raw), fallbackPassword);
  } catch {
    return { password: fallbackPassword, recoveryEmail: "" };
  }
}

export function writeAdminCredentials(
  credentials: StoredAdminCredentials,
  fallbackPassword: string,
): StoredAdminCredentials {
  const next = sanitize(credentials, fallbackPassword);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      ADMIN_CREDENTIALS_STORAGE_KEY,
      JSON.stringify(next),
    );
    window.dispatchEvent(
      new CustomEvent(ADMIN_CREDENTIALS_EVENT, {
        detail: { credentials: next },
      }),
    );
  }
  return next;
}

export function changeAdminPassword(options: {
  fallbackPassword: string;
  currentPassword: string;
  nextPassword: string;
}): { ok: true; credentials: StoredAdminCredentials } | { ok: false; error: string } {
  const stored = readAdminCredentials(options.fallbackPassword);
  if (options.currentPassword !== stored.password) {
    return { ok: false, error: "Current password is incorrect." };
  }
  if (options.nextPassword.trim().length < 4) {
    return { ok: false, error: "New password must be at least 4 characters." };
  }
  if (options.nextPassword === options.currentPassword) {
    return { ok: false, error: "New password must be different." };
  }
  const credentials = writeAdminCredentials(
    { ...stored, password: options.nextPassword },
    options.fallbackPassword,
  );
  return { ok: true, credentials };
}

export function resetAdminPassword(options: {
  fallbackPassword: string;
  email: string;
  nextPassword: string;
}): { ok: true; credentials: StoredAdminCredentials } | { ok: false; error: string } {
  const email = options.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid recovery email." };
  }
  if (options.nextPassword.trim().length < 4) {
    return { ok: false, error: "New password must be at least 4 characters." };
  }

  const stored = readAdminCredentials(options.fallbackPassword);
  if (stored.recoveryEmail) {
    if (stored.recoveryEmail.toLowerCase() !== email) {
      return { ok: false, error: "Recovery email does not match." };
    }
  }

  const credentials = writeAdminCredentials(
    {
      password: options.nextPassword,
      recoveryEmail: email,
    },
    options.fallbackPassword,
  );
  return { ok: true, credentials };
}

export function useAdminCredentials(fallbackPassword: string): StoredAdminCredentials {
  const [credentials, setCredentials] = useState<StoredAdminCredentials>({
    password: fallbackPassword,
    recoveryEmail: "",
  });

  useEffect(() => {
    setCredentials(readAdminCredentials(fallbackPassword));
    const onChange = (event: Event) => {
      const detail = (
        event as CustomEvent<{ credentials: StoredAdminCredentials }>
      ).detail;
      if (detail?.credentials) {
        setCredentials(detail.credentials);
        return;
      }
      setCredentials(readAdminCredentials(fallbackPassword));
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === ADMIN_CREDENTIALS_STORAGE_KEY) {
        setCredentials(readAdminCredentials(fallbackPassword));
      }
    };
    window.addEventListener(ADMIN_CREDENTIALS_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(ADMIN_CREDENTIALS_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [fallbackPassword]);

  return credentials;
}
