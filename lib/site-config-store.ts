import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getAdminCredentials } from "./dashboard-config";
import {
  DASHBOARD_CONFIG_GOOGLE_DOC_URL,
  readProgramConfigFromGoogleDoc,
  writeProgramConfigToGoogleDoc,
} from "./google-doc-dashboard-config";
import {
  applySiteConfigPatch,
  createDefaultSiteAdminConfig,
  sanitizeProgramConfig,
  sanitizeSiteAdminConfig,
  toPublicSiteConfig,
  type SiteAdminConfig,
  type SiteConfigPatch,
  type SiteConfigPublic,
} from "./site-config";

const GLOBAL_KEY = "__esadSiteAdminConfig__";
const GOOGLE_DOC_CACHE_KEY = "__esadGoogleDocProgramConfigCache__";
const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "admin-site-config.json");
const GOOGLE_DOC_CACHE_TTL_MS = 30_000;

type GlobalSiteStore = typeof globalThis & {
  [GLOBAL_KEY]?: SiteAdminConfig;
};

type GoogleDocProgramCache = {
  programConfig: ReturnType<typeof sanitizeProgramConfig> | null;
  fetchedAtMs: number;
};

type GlobalGoogleDocCache = typeof globalThis & {
  [GOOGLE_DOC_CACHE_KEY]?: GoogleDocProgramCache;
};

export type SiteConfigStoreOptions = {
  /** Google OAuth access token from the signed-in user (optional). */
  googleAccessToken?: string | null;
  /** When true, do not pull Dashboard Configuration from the Google Doc. */
  skipGoogleDoc?: boolean;
  /** Bypass the short Google Doc TTL cache (used for live Hero SSR). */
  forceGoogleDocRefresh?: boolean;
};

function memoryStore(): SiteAdminConfig | undefined {
  return (globalThis as GlobalSiteStore)[GLOBAL_KEY];
}

function setMemoryStore(config: SiteAdminConfig): void {
  (globalThis as GlobalSiteStore)[GLOBAL_KEY] = config;
}

async function readPersistedConfig(): Promise<SiteAdminConfig | null> {
  try {
    const text = await readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(text) as unknown;
    return sanitizeSiteAdminConfig(parsed);
  } catch {
    return null;
  }
}

async function writePersistedConfig(config: SiteAdminConfig): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

async function loadBaseSiteAdminConfig(): Promise<SiteAdminConfig> {
  const persisted = await readPersistedConfig();
  if (persisted) return persisted;

  const memory = memoryStore();
  if (memory) return memory;

  return createDefaultSiteAdminConfig();
}

/**
 * Overlay Dashboard Configuration from the shared Google Doc.
 * The Google Doc is the source of truth for Hero title / lead / metric labels /
 * LED thresholds for every user. Host file is only a cache / offline fallback.
 */
async function applyGoogleDocProgramConfig(
  base: SiteAdminConfig,
  options?: SiteConfigStoreOptions,
): Promise<SiteAdminConfig> {
  if (options?.skipGoogleDoc) return base;

  const cacheStore = globalThis as GlobalGoogleDocCache;
  const cached = cacheStore[GOOGLE_DOC_CACHE_KEY];
  const now = Date.now();
  // Only reuse a successful Doc pull within the TTL. Never cache misses/failures
  // as lasting "empty" state — that would block Hero updates for all users.
  const canUseCache =
    !options?.forceGoogleDocRefresh &&
    !options?.googleAccessToken?.trim() &&
    cached != null &&
    cached.programConfig != null &&
    now - cached.fetchedAtMs < GOOGLE_DOC_CACHE_TTL_MS;

  try {
    let fromDoc = canUseCache ? cached.programConfig : null;
    if (!canUseCache) {
      fromDoc = await readProgramConfigFromGoogleDoc({
        accessToken: options?.googleAccessToken,
      });
      if (fromDoc) {
        cacheStore[GOOGLE_DOC_CACHE_KEY] = {
          programConfig: fromDoc,
          fetchedAtMs: now,
        };
      } else {
        delete cacheStore[GOOGLE_DOC_CACHE_KEY];
      }
    }
    if (!fromDoc) return base;

    const next: SiteAdminConfig = {
      ...base,
      programConfig: sanitizeProgramConfig(fromDoc),
      // Treat a successful Google Doc pull as persisted shared config.
      updatedAt: base.updatedAt ?? new Date().toISOString(),
    };
    // Keep a host-file cache so SSR still has the last known Doc values if
    // Google is briefly unreachable.
    try {
      await writePersistedConfig(next);
    } catch {
      // Cache write is best-effort.
    }
    return next;
  } catch {
    // Do not poison the TTL cache with a failed read.
    return base;
  }
}

/**
 * Load Admin config. Dashboard Configuration for the live Hero always comes
 * from the shared Google Doc for every user when the Doc is readable.
 */
export async function loadSiteAdminConfig(
  options?: SiteConfigStoreOptions,
): Promise<SiteAdminConfig> {
  const base = await loadBaseSiteAdminConfig();
  const withDoc = await applyGoogleDocProgramConfig(base, options);
  setMemoryStore(withDoc);
  return withDoc;
}

export async function getPublicSiteConfig(
  options?: SiteConfigStoreOptions,
): Promise<SiteConfigPublic> {
  const config = await loadSiteAdminConfig(options);
  return toPublicSiteConfig(config);
}

export async function getHostAdminPassword(
  options?: SiteConfigStoreOptions,
): Promise<string> {
  const config = await loadSiteAdminConfig({
    ...options,
    // Password checks should not depend on Google Doc availability.
    skipGoogleDoc: true,
  });
  return config.adminCredentials.password || getAdminCredentials().password;
}

export function isAuthorizedSiteAdmin(
  providedPassword: string | null | undefined,
  hostPassword: string,
): boolean {
  const provided = providedPassword?.trim() ?? "";
  if (!provided) return false;
  return provided === hostPassword;
}

export async function updateSiteAdminConfig(
  patch: SiteConfigPatch,
  options?: SiteConfigStoreOptions,
): Promise<SiteAdminConfig> {
  const current = await loadSiteAdminConfig(options);
  const next = applySiteConfigPatch(current, patch);

  if (patch.programConfig) {
    // Dashboard Configuration saves must land in the shared Google Doc.
    await writeProgramConfigToGoogleDoc(next.programConfig, {
      accessToken: options?.googleAccessToken,
    });
    (globalThis as GlobalGoogleDocCache)[GOOGLE_DOC_CACHE_KEY] = {
      programConfig: next.programConfig,
      fetchedAtMs: Date.now(),
    };
  }

  await writePersistedConfig(next);
  setMemoryStore(next);
  return next;
}

export async function verifyAdminLogin(
  username: string,
  password: string,
): Promise<boolean> {
  const expected = getAdminCredentials();
  const hostPassword = await getHostAdminPassword();
  return username.trim() === expected.username && password === hostPassword;
}

export async function changeHostAdminPassword(options: {
  currentPassword: string;
  nextPassword: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const hostPassword = await getHostAdminPassword();
  if (options.currentPassword !== hostPassword) {
    return { ok: false, error: "Current password is incorrect." };
  }
  if (options.nextPassword.trim().length < 4) {
    return { ok: false, error: "New password must be at least 4 characters." };
  }
  if (options.nextPassword === options.currentPassword) {
    return { ok: false, error: "New password must be different." };
  }
  await updateSiteAdminConfig(
    {
      adminCredentials: { password: options.nextPassword },
    },
    { skipGoogleDoc: true },
  );
  return { ok: true };
}

export async function resetHostAdminPassword(options: {
  email: string;
  nextPassword: string;
}): Promise<{ ok: true; recoveryEmail: string } | { ok: false; error: string }> {
  const email = options.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid recovery email." };
  }
  if (options.nextPassword.trim().length < 4) {
    return { ok: false, error: "New password must be at least 4 characters." };
  }

  const config = await loadSiteAdminConfig({ skipGoogleDoc: true });
  if (config.adminCredentials.recoveryEmail) {
    if (config.adminCredentials.recoveryEmail.toLowerCase() !== email) {
      return { ok: false, error: "Recovery email does not match." };
    }
  }

  await updateSiteAdminConfig(
    {
      adminCredentials: {
        password: options.nextPassword,
        recoveryEmail: email,
      },
    },
    { skipGoogleDoc: true },
  );
  return { ok: true, recoveryEmail: email };
}

export function getDashboardConfigGoogleDocUrl(): string {
  return DASHBOARD_CONFIG_GOOGLE_DOC_URL;
}
