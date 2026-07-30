"use client";

import type { CustomCardRecord } from "../lib/custom-cards";
import type { DashboardConfig } from "../lib/dashboard-config";
import type { ProgramConfig } from "../lib/program-config";
import type { SiteConfigPatch, SiteConfigPublic } from "../lib/site-config";
import {
  cloneDefaultDashboardConfigs,
  sanitizeCustomCards,
  sanitizeDashboardConfigs,
  sanitizeProgramConfig,
} from "../lib/site-config";
import { getAdminSessionPassword } from "./admin-auth";
import { getGoogleAccessToken } from "./google-access-token";

function siteConfigRequestHeaders(
  extra?: Record<string, string>,
): Record<string, string> {
  const headers: Record<string, string> = { ...(extra ?? {}) };
  const googleAccessToken = getGoogleAccessToken();
  if (googleAccessToken) {
    headers["x-esad-google-access-token"] = googleAccessToken;
  }
  return headers;
}

export const SITE_CONFIG_EVENT = "esad-site-config-change";

const LEGACY_PROGRAM_KEY = "esad-program-config";
const LEGACY_DASHBOARD_KEY = "esad-dashboard-configs";
const LEGACY_CUSTOM_CARDS_KEY = "esad-custom-cards";
const LEGACY_ADMIN_CREDENTIALS_KEY = "esad-admin-credentials";
const MIGRATION_FLAG_KEY = "esad-site-config-migrated";

type SiteConfigCache = SiteConfigPublic;

let cache: SiteConfigCache | null = null;
let hydratePromise: Promise<SiteConfigCache> | null = null;
/** True after a successful `/api/site-config` pull this page session. */
let pulledFromHost = false;

function emitSiteConfigChange(next: SiteConfigCache) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(SITE_CONFIG_EVENT, { detail: { config: next } }),
  );
}

function setCache(next: SiteConfigCache, emit = true): SiteConfigCache {
  cache = next;
  if (emit) emitSiteConfigChange(next);
  return next;
}

function defaultPublicConfig(): SiteConfigCache {
  return {
    programConfig: sanitizeProgramConfig(null),
    dashboardConfigs: cloneDefaultDashboardConfigs(),
    customCards: [],
    recoveryEmail: "",
    persisted: false,
    updatedAt: null,
  };
}

function readLegacyLocalPatch(): SiteConfigPatch | null {
  if (typeof window === "undefined") return null;
  if (window.localStorage.getItem(MIGRATION_FLAG_KEY) === "1") return null;

  const patch: SiteConfigPatch = {};
  let hasLegacy = false;

  try {
    const programRaw = window.localStorage.getItem(LEGACY_PROGRAM_KEY);
    if (programRaw) {
      patch.programConfig = sanitizeProgramConfig(JSON.parse(programRaw));
      hasLegacy = true;
    }
  } catch {
    // ignore corrupt legacy program config
  }

  try {
    const dashRaw = window.localStorage.getItem(LEGACY_DASHBOARD_KEY);
    if (dashRaw) {
      patch.dashboardConfigs = sanitizeDashboardConfigs(JSON.parse(dashRaw));
      hasLegacy = true;
    }
  } catch {
    // ignore corrupt legacy dashboard configs
  }

  try {
    const cardsRaw = window.localStorage.getItem(LEGACY_CUSTOM_CARDS_KEY);
    if (cardsRaw) {
      patch.customCards = sanitizeCustomCards(JSON.parse(cardsRaw));
      hasLegacy = true;
    }
  } catch {
    // ignore corrupt legacy custom cards
  }

  try {
    const credRaw = window.localStorage.getItem(LEGACY_ADMIN_CREDENTIALS_KEY);
    if (credRaw) {
      const parsed = JSON.parse(credRaw) as {
        password?: unknown;
        recoveryEmail?: unknown;
      };
      patch.adminCredentials = {
        password:
          typeof parsed.password === "string" ? parsed.password : undefined,
        recoveryEmail:
          typeof parsed.recoveryEmail === "string"
            ? parsed.recoveryEmail
            : undefined,
      };
      hasLegacy = true;
    }
  } catch {
    // ignore corrupt legacy credentials
  }

  return hasLegacy ? patch : null;
}

function clearLegacyLocalAdminKeys() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LEGACY_PROGRAM_KEY);
  window.localStorage.removeItem(LEGACY_DASHBOARD_KEY);
  window.localStorage.removeItem(LEGACY_CUSTOM_CARDS_KEY);
  window.localStorage.removeItem(LEGACY_ADMIN_CREDENTIALS_KEY);
  window.localStorage.setItem(MIGRATION_FLAG_KEY, "1");
}

async function migrateLegacyIfNeeded(host: SiteConfigCache): Promise<SiteConfigCache> {
  if (host.persisted) {
    clearLegacyLocalAdminKeys();
    return host;
  }

  const patch = readLegacyLocalPatch();
  if (!patch) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MIGRATION_FLAG_KEY, "1");
    }
    return host;
  }

  // Prefer session password, else try legacy/local default password.
  const legacyPassword =
    getAdminSessionPassword() ||
    (typeof patch.adminCredentials?.password === "string"
      ? patch.adminCredentials.password
      : "esad");

  try {
    const response = await fetch("/api/site-config", {
      method: "PUT",
      headers: siteConfigRequestHeaders({
        "Content-Type": "application/json",
        "x-esad-admin-password": legacyPassword,
      }),
      body: JSON.stringify(patch),
      cache: "no-store",
    });
    if (!response.ok) return host;
    const migrated = (await response.json()) as SiteConfigCache;
    clearLegacyLocalAdminKeys();
    return migrated;
  } catch {
    return host;
  }
}

export function getCachedSiteConfig(): SiteConfigCache {
  return cache ?? defaultPublicConfig();
}

/**
 * Seed the browser cache from host config loaded during SSR.
 * No-ops on the server and when a client cache already exists.
 */
export function seedSiteConfigFromServer(initial: SiteConfigPublic): void {
  if (typeof window === "undefined") return;
  if (cache) return;
  setCache(
    {
      programConfig: sanitizeProgramConfig(initial.programConfig),
      dashboardConfigs: sanitizeDashboardConfigs(initial.dashboardConfigs),
      customCards: sanitizeCustomCards(initial.customCards),
      recoveryEmail:
        typeof initial.recoveryEmail === "string" ? initial.recoveryEmail : "",
      persisted: Boolean(initial.persisted),
      updatedAt: initial.updatedAt ?? null,
    },
    false,
  );
}

export async function hydrateSiteConfigFromHost(): Promise<SiteConfigCache> {
  if (typeof window === "undefined") {
    return defaultPublicConfig();
  }
  // After a successful host pull, reuse cache until refreshSiteConfigFromHost.
  if (pulledFromHost && cache) return cache;
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    try {
      const response = await fetch("/api/site-config", {
        cache: "no-store",
        headers: siteConfigRequestHeaders(),
      });
      if (!response.ok) {
        // Keep any existing cache instead of wiping Dashboard Configuration.
        if (cache) return cache;
        return setCache(defaultPublicConfig());
      }
      const host = (await response.json()) as SiteConfigCache;
      const maybeMigrated = await migrateLegacyIfNeeded({
        programConfig: sanitizeProgramConfig(host.programConfig),
        dashboardConfigs: sanitizeDashboardConfigs(host.dashboardConfigs),
        customCards: sanitizeCustomCards(host.customCards),
        recoveryEmail:
          typeof host.recoveryEmail === "string" ? host.recoveryEmail : "",
        persisted: Boolean(host.persisted),
        updatedAt: host.updatedAt ?? null,
      });
      pulledFromHost = true;
      return setCache(maybeMigrated);
    } catch {
      if (cache) return cache;
      return setCache(defaultPublicConfig());
    } finally {
      hydratePromise = null;
    }
  })();

  return hydratePromise;
}

/** Force re-fetch host Admin config (used by the 1-second dashboard refresh). */
export async function refreshSiteConfigFromHost(): Promise<SiteConfigCache> {
  // Keep current values visible while re-fetching from the Google Doc / host.
  hydratePromise = null;
  pulledFromHost = false;
  return hydrateSiteConfigFromHost();
}

export async function persistSiteConfigPatch(
  patch: SiteConfigPatch,
): Promise<SiteConfigCache> {
  const password = getAdminSessionPassword();
  if (!password) {
    throw new Error("Admin session required to save host configuration.");
  }

  // Optimistic local cache update for snappy UI.
  const current = getCachedSiteConfig();
  const optimistic: SiteConfigCache = {
    ...current,
    programConfig: patch.programConfig
      ? sanitizeProgramConfig(patch.programConfig)
      : current.programConfig,
    dashboardConfigs: patch.dashboardConfigs
      ? sanitizeDashboardConfigs(patch.dashboardConfigs)
      : patch.dashboardConfig
        ? {
            ...current.dashboardConfigs,
            [patch.dashboardConfig.dashboardId]: patch.dashboardConfig,
          }
        : current.dashboardConfigs,
    customCards: patch.customCards
      ? sanitizeCustomCards(patch.customCards)
      : current.customCards,
    persisted: true,
    updatedAt: new Date().toISOString(),
  };
  if (patch.dashboardConfig && patch.customCards == null) {
    const id = patch.dashboardConfig.dashboardId;
    optimistic.customCards = optimistic.customCards.map((card) =>
      card.id === id
        ? { id, config: { ...patch.dashboardConfig! } }
        : card,
    );
  }
  setCache(optimistic);

  const response = await fetch("/api/site-config", {
    method: "PUT",
    headers: siteConfigRequestHeaders({
      "Content-Type": "application/json",
      "x-esad-admin-password": password,
    }),
    body: JSON.stringify(patch),
    cache: "no-store",
  });
  if (!response.ok) {
    let detail = `Failed to save site config (${response.status}).`;
    try {
      const failure = (await response.json()) as { error?: string };
      if (failure.error?.trim()) detail = failure.error.trim();
    } catch {
      // keep status-based message
    }
    // Re-hydrate to recover authoritative host / Google Doc state.
    cache = null;
    await hydrateSiteConfigFromHost();
    throw new Error(detail);
  }

  const saved = (await response.json()) as SiteConfigCache & {
    googleDocWritten?: boolean;
  };
  if (patch.programConfig && saved.googleDocWritten === false) {
    throw new Error(
      "Dashboard Configuration was not written to the shared Google Doc.",
    );
  }
  return setCache({
    programConfig: sanitizeProgramConfig(saved.programConfig),
    dashboardConfigs: sanitizeDashboardConfigs(saved.dashboardConfigs),
    customCards: sanitizeCustomCards(saved.customCards),
    recoveryEmail:
      typeof saved.recoveryEmail === "string" ? saved.recoveryEmail : "",
    persisted: Boolean(saved.persisted),
    updatedAt: saved.updatedAt ?? null,
  });
}

export function readCachedProgramConfig(): ProgramConfig {
  return getCachedSiteConfig().programConfig;
}

export function readCachedDashboardConfigs(): Record<string, DashboardConfig> {
  return getCachedSiteConfig().dashboardConfigs;
}

export function readCachedCustomCards(): CustomCardRecord[] {
  return getCachedSiteConfig().customCards;
}

export function readCachedRecoveryEmail(): string {
  return getCachedSiteConfig().recoveryEmail;
}

export function subscribeSiteConfig(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = () => onChange();
  window.addEventListener(SITE_CONFIG_EVENT, handler);
  return () => window.removeEventListener(SITE_CONFIG_EVENT, handler);
}
