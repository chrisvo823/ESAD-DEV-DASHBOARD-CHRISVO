import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { getAdminCredentials } from "./dashboard-config";
import {
  applySiteConfigPatch,
  createDefaultSiteAdminConfig,
  sanitizeSiteAdminConfig,
  toPublicSiteConfig,
  type SiteAdminConfig,
  type SiteConfigPatch,
  type SiteConfigPublic,
} from "./site-config";

const GLOBAL_KEY = "__esadSiteAdminConfig__";
const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "admin-site-config.json");
const DATA_FILE_TMP = path.join(DATA_DIR, "admin-site-config.json.tmp");

type GlobalSiteStore = typeof globalThis & {
  [GLOBAL_KEY]?: SiteAdminConfig;
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

/**
 * Prefer the host file whenever it exists so Dashboard Configuration cannot
 * disappear behind a stale in-memory default from another isolate / cold start.
 */
export async function loadSiteAdminConfig(): Promise<SiteAdminConfig> {
  const persisted = await readPersistedConfig();
  if (persisted) {
    setMemoryStore(persisted);
    return persisted;
  }

  const memory = memoryStore();
  if (memory) return memory;

  const config = createDefaultSiteAdminConfig();
  setMemoryStore(config);
  return config;
}

export async function getPublicSiteConfig(): Promise<SiteConfigPublic> {
  const config = await loadSiteAdminConfig();
  return toPublicSiteConfig(config);
}

export async function getHostAdminPassword(): Promise<string> {
  const config = await loadSiteAdminConfig();
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
): Promise<SiteAdminConfig> {
  const current = await loadSiteAdminConfig();
  const next = applySiteConfigPatch(current, patch);
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
  await updateSiteAdminConfig({
    adminCredentials: { password: options.nextPassword },
  });
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

  const config = await loadSiteAdminConfig();
  if (config.adminCredentials.recoveryEmail) {
    if (config.adminCredentials.recoveryEmail.toLowerCase() !== email) {
      return { ok: false, error: "Recovery email does not match." };
    }
  }

  await updateSiteAdminConfig({
    adminCredentials: {
      password: options.nextPassword,
      recoveryEmail: email,
    },
  });
  return { ok: true, recoveryEmail: email };
}
