import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { getAdminCredentials, type DashboardConfig } from "./dashboard-config";
import { isCustomCardId } from "./custom-cards";
import {
  readAllCardConfigsFromGoogleDoc,
  writeCardConfigToGoogleDoc,
} from "./google-doc-card-config";
import {
  DASHBOARD_CONFIG_GOOGLE_DOC_ID,
  DASHBOARD_CONFIG_GOOGLE_DOC_URL,
  googleDocEditUrl,
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
const GOOGLE_CARD_DOC_CACHE_KEY = "__esadGoogleDocCardConfigCache__";
const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "admin-site-config.json");
const DATA_FILE_TMP = path.join(DATA_DIR, "admin-site-config.json.tmp");
const GOOGLE_DOC_CACHE_TTL_MS = 30_000;

/** Resolve the Dashboard Configuration Google Doc id (bound Load file or shared default). */
export function resolveDashboardConfigDocumentId(
  boundDocumentId?: string | null,
): string {
  const trimmed = boundDocumentId?.trim() ?? "";
  return trimmed || DASHBOARD_CONFIG_GOOGLE_DOC_ID;
}

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

type GoogleDocCardCacheEntry = {
  configsById: Record<string, DashboardConfig>;
  fetchedAtMs: number;
};

type GoogleDocCardCache = {
  byDocumentId: Record<string, GoogleDocCardCacheEntry>;
};

type GlobalGoogleCardDocCache = typeof globalThis & {
  [GOOGLE_CARD_DOC_CACHE_KEY]?: GoogleDocCardCache;
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

/** Absolute path of the host Admin / Dashboard Configuration file. */
export function getHostSiteConfigPath(): string {
  return DATA_FILE;
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

/**
 * Persist host Admin config and verify the file round-trips.
 * Throws if the Dashboard Configuration cannot be written/read back.
 */
async function writePersistedConfig(config: SiteAdminConfig): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const payload = `${JSON.stringify(config, null, 2)}\n`;
  // Atomic replace so a crashed mid-write cannot leave an empty/corrupt host file
  // that would make the next load fall back to defaults (wiping custom config).
  await writeFile(DATA_FILE_TMP, payload, "utf8");
  await rename(DATA_FILE_TMP, DATA_FILE);

  // Read-back guard: never report success unless the host file contains the save.
  let verified: SiteAdminConfig | null = null;
  try {
    verified = await readPersistedConfig();
  } catch {
    verified = null;
  }
  if (!verified) {
    throw new Error(
      `Host configuration file was not readable after save (${DATA_FILE}).`,
    );
  }
  if (
    verified.programConfig.dashboardName !== config.programConfig.dashboardName ||
    verified.programConfig.programLead !== config.programConfig.programLead ||
    verified.updatedAt !== config.updatedAt
  ) {
    throw new Error(
      "Host configuration file read-back did not match the saved Dashboard Configuration.",
    );
  }
}

async function loadBaseSiteAdminConfig(): Promise<SiteAdminConfig> {
  const persisted = await readPersistedConfig();
  if (persisted) return persisted;

  const memory = memoryStore();
  if (memory) return sanitizeSiteAdminConfig(memory);

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
        documentId: resolveDashboardConfigDocumentId(
          base.dashboardConfigDocumentId,
        ),
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
 * Overlay Card Configuration from each selected Google Doc.
 * Docs may contain one or more Card # sections; each section configures the
 * matching card id for every user. Host file values are only a cache.
 */
async function applyGoogleDocCardConfigs(
  base: SiteAdminConfig,
  options?: SiteConfigStoreOptions,
): Promise<SiteAdminConfig> {
  if (options?.skipGoogleDoc) return base;

  const mappedDocumentIds = base.cardConfigDocumentIds ?? {};
  const uniqueDocumentIds = [
    ...new Set(Object.values(mappedDocumentIds).map((id) => id.trim())),
  ].filter(Boolean);
  if (uniqueDocumentIds.length === 0) return base;

  const cacheStore = globalThis as GlobalGoogleCardDocCache;
  const cache = cacheStore[GOOGLE_CARD_DOC_CACHE_KEY] ?? { byDocumentId: {} };
  const now = Date.now();
  const nextConfigs = { ...base.dashboardConfigs };
  const nextDocumentIds = { ...mappedDocumentIds };
  let changed = false;

  await Promise.all(
    uniqueDocumentIds.map(async (documentId) => {
      const cached = cache.byDocumentId[documentId];
      const canUseCache =
        !options?.forceGoogleDocRefresh &&
        !options?.googleAccessToken?.trim() &&
        cached != null &&
        now - cached.fetchedAtMs < GOOGLE_DOC_CACHE_TTL_MS;

      try {
        let configsById = canUseCache ? cached.configsById : null;
        if (!canUseCache) {
          const configs = await readAllCardConfigsFromGoogleDoc({
            documentId,
            accessToken: options?.googleAccessToken,
          });
          if (!configs || configs.length === 0) {
            delete cache.byDocumentId[documentId];
            return;
          }
          configsById = Object.fromEntries(
            configs.map((config) => [config.dashboardId, config]),
          );
          cache.byDocumentId[documentId] = {
            configsById,
            fetchedAtMs: now,
          };
        }
        if (!configsById) return;
        for (const [dashboardId, config] of Object.entries(configsById)) {
          nextConfigs[dashboardId] = { ...config, dashboardId };
          nextDocumentIds[dashboardId] = documentId;
          changed = true;
        }
      } catch {
        // Keep host cache when the Doc is briefly unreachable.
      }
    }),
  );

  cacheStore[GOOGLE_CARD_DOC_CACHE_KEY] = cache;
  if (!changed) return base;

  const next: SiteAdminConfig = {
    ...base,
    dashboardConfigs: nextConfigs,
    cardConfigDocumentIds: nextDocumentIds,
    customCards: Object.values(nextConfigs)
      .filter((config) => isCustomCardId(String(config.dashboardId)))
      .map((config) => ({
        id: config.dashboardId,
        config: { ...config, dashboardId: config.dashboardId },
      })),
    updatedAt: base.updatedAt ?? new Date().toISOString(),
  };

  try {
    await writePersistedConfig(next);
  } catch {
    // Cache write is best-effort.
  }
  return next;
}

/**
 * Load Admin config. Dashboard Configuration for the live Hero always comes
 * from the shared Google Doc for every user when the Doc is readable.
 * Card Configuration comes from each card's selected Google Doc when mapped.
 */
export async function loadSiteAdminConfig(
  options?: SiteConfigStoreOptions,
): Promise<SiteAdminConfig> {
  const base = await loadBaseSiteAdminConfig();
  const withProgramDoc = await applyGoogleDocProgramConfig(base, options);
  const withCardDocs = await applyGoogleDocCardConfigs(withProgramDoc, options);
  setMemoryStore(withCardDocs);
  return withCardDocs;
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
    // Dashboard Configuration saves must land in the bound Google Doc immediately.
    const documentId = resolveDashboardConfigDocumentId(
      next.dashboardConfigDocumentId || patch.dashboardConfigDocumentId,
    );
    await writeProgramConfigToGoogleDoc(next.programConfig, {
      accessToken: options?.googleAccessToken,
      documentId,
    });
    (globalThis as GlobalGoogleDocCache)[GOOGLE_DOC_CACHE_KEY] = {
      programConfig: next.programConfig,
      fetchedAtMs: Date.now(),
    };
  }

  if (patch.publishCardConfigToGoogleDoc) {
    const multiConfigs = (patch.cardConfigsToPublish ?? []).filter(
      (config) => config?.dashboardId,
    );
    if (multiConfigs.length > 0) {
      const documentId =
        multiConfigs
          .map((config) => next.cardConfigDocumentIds[config.dashboardId]?.trim())
          .find(Boolean) ||
        multiConfigs
          .map(
            (config) =>
              patch.cardConfigDocumentIds?.[config.dashboardId]?.trim() ?? "",
          )
          .find(Boolean) ||
        "";
      if (!documentId) {
        throw new Error(
          "Select a Card Configuration Google Doc with Load Config before Saving.",
        );
      }
      const written = await writeCardConfigToGoogleDoc(multiConfigs, documentId, {
        accessToken: options?.googleAccessToken,
      });
      const cardCache = (globalThis as GlobalGoogleCardDocCache)[
        GOOGLE_CARD_DOC_CACHE_KEY
      ] ?? { byDocumentId: {} };
      const configsById: Record<string, (typeof multiConfigs)[number]> = {};
      for (const config of multiConfigs) {
        configsById[config.dashboardId] = {
          ...(next.dashboardConfigs[config.dashboardId] ?? config),
          dashboardId: config.dashboardId,
        };
      }
      cardCache.byDocumentId[documentId] = {
        configsById: {
          ...(cardCache.byDocumentId[documentId]?.configsById ?? {}),
          ...configsById,
        },
        fetchedAtMs: Date.now(),
      };
      (globalThis as GlobalGoogleCardDocCache)[GOOGLE_CARD_DOC_CACHE_KEY] =
        cardCache;
      void written;
    } else if (patch.dashboardConfig) {
      const dashboardId = patch.dashboardConfig.dashboardId;
      const documentId =
        next.cardConfigDocumentIds[dashboardId]?.trim() ||
        patch.cardConfigDocumentIds?.[dashboardId]?.trim() ||
        "";
      if (!documentId) {
        throw new Error(
          "Select a Card Configuration Google Doc with Load Config before Saving.",
        );
      }
      const savedConfig = {
        ...(next.dashboardConfigs[dashboardId] ?? patch.dashboardConfig),
        dashboardId,
      };
      const written = await writeCardConfigToGoogleDoc(savedConfig, documentId, {
        accessToken: options?.googleAccessToken,
      });
      const cardCache = (globalThis as GlobalGoogleCardDocCache)[
        GOOGLE_CARD_DOC_CACHE_KEY
      ] ?? { byDocumentId: {} };
      const existing = cardCache.byDocumentId[documentId]?.configsById ?? {};
      cardCache.byDocumentId[documentId] = {
        configsById: { ...existing, [dashboardId]: savedConfig },
        fetchedAtMs: Date.now(),
      };
      (globalThis as GlobalGoogleCardDocCache)[GOOGLE_CARD_DOC_CACHE_KEY] =
        cardCache;
      void written;
    }
  }

  // Write + verify disk first, then memory — save never succeeds without a host file.
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

export function getDashboardConfigGoogleDocUrl(
  boundDocumentId?: string | null,
): string {
  const documentId = resolveDashboardConfigDocumentId(boundDocumentId);
  return documentId === DASHBOARD_CONFIG_GOOGLE_DOC_ID
    ? DASHBOARD_CONFIG_GOOGLE_DOC_URL
    : googleDocEditUrl(documentId);
}
