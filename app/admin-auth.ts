"use client";

import { useEffect, useState } from "react";

export const ADMIN_SESSION_KEY = "esad-admin-authenticated";
export const ADMIN_AUTH_EVENT = "esad-admin-auth-change";

export function isAdminAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(ADMIN_SESSION_KEY) === "1";
}

export function setAdminAuthenticated(authenticated: boolean): void {
  if (typeof window === "undefined") return;
  if (authenticated) {
    window.sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
  } else {
    window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
  }
  window.dispatchEvent(
    new CustomEvent(ADMIN_AUTH_EVENT, { detail: { authenticated } }),
  );
}

export function useAdminAuthenticated(): boolean {
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    setAuthenticated(isAdminAuthenticated());
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<{ authenticated: boolean }>).detail;
      setAuthenticated(Boolean(detail?.authenticated));
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === ADMIN_SESSION_KEY) {
        setAuthenticated(isAdminAuthenticated());
      }
    };
    window.addEventListener(ADMIN_AUTH_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(ADMIN_AUTH_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return authenticated;
}
