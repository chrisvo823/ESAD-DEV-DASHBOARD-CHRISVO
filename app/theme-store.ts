"use client";

import { useEffect, useState } from "react";
import {
  isConcreteThemeId,
  isThemeId,
  resolveThemeId,
  type ConcreteThemeId,
  type ThemeId,
} from "../lib/themes";

export const THEME_STORAGE_KEY = "esad-dashboard-theme";
export const THEME_RESOLVED_STORAGE_KEY = "esad-dashboard-theme-resolved";
export const THEME_EVENT = "esad-dashboard-theme-change";

export type ThemeState = {
  selection: ThemeId;
  resolved: ConcreteThemeId;
};

const DEFAULT_THEME_STATE: ThemeState = {
  selection: "default",
  resolved: "default",
};

function applyThemeToDocument(resolved: ConcreteThemeId): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = resolved;
  document.body.dataset.theme = resolved;
}

export function readThemeState(): ThemeState {
  if (typeof window === "undefined") return DEFAULT_THEME_STATE;
  try {
    const selectionRaw = window.localStorage.getItem(THEME_STORAGE_KEY);
    const resolvedRaw = window.localStorage.getItem(THEME_RESOLVED_STORAGE_KEY);
    const selection =
      selectionRaw && isThemeId(selectionRaw) ? selectionRaw : "default";

    if (selection === "lucky") {
      // Keep a prior Feeling Lucky roll when still valid; otherwise roll again.
      if (resolvedRaw && isConcreteThemeId(resolvedRaw) && resolvedRaw.startsWith("lucky-")) {
        return { selection, resolved: resolvedRaw };
      }
      const resolved = resolveThemeId("lucky");
      window.localStorage.setItem(THEME_RESOLVED_STORAGE_KEY, resolved);
      return { selection, resolved };
    }

    const resolved =
      resolvedRaw && isConcreteThemeId(resolvedRaw) && resolvedRaw === selection
        ? resolvedRaw
        : resolveThemeId(selection);
    return { selection, resolved };
  } catch {
    return DEFAULT_THEME_STATE;
  }
}

export function writeThemeSelection(selection: ThemeId): ThemeState {
  // Feeling Lucky always re-rolls on selection so users can “try again”.
  const resolved = resolveThemeId(selection);
  const next: ThemeState = { selection, resolved };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(THEME_STORAGE_KEY, selection);
    window.localStorage.setItem(THEME_RESOLVED_STORAGE_KEY, resolved);
    applyThemeToDocument(resolved);
    window.dispatchEvent(
      new CustomEvent(THEME_EVENT, { detail: { theme: next } }),
    );
  }
  return next;
}

export function useThemeState(): ThemeState {
  const [theme, setTheme] = useState<ThemeState>(DEFAULT_THEME_STATE);

  useEffect(() => {
    const current = readThemeState();
    setTheme(current);
    applyThemeToDocument(current.resolved);

    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<{ theme: ThemeState }>).detail;
      if (detail?.theme) {
        setTheme(detail.theme);
        applyThemeToDocument(detail.theme.resolved);
        return;
      }
      const next = readThemeState();
      setTheme(next);
      applyThemeToDocument(next.resolved);
    };
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === THEME_STORAGE_KEY ||
        event.key === THEME_RESOLVED_STORAGE_KEY
      ) {
        const next = readThemeState();
        setTheme(next);
        applyThemeToDocument(next.resolved);
      }
    };

    window.addEventListener(THEME_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(THEME_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return theme;
}
