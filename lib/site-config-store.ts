import { mkdir, readFile, writeFile } from "node:fs/promises";
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

type GlobalSiteStore = typeof globalThis & {
  [GLOBAL_KEY]?: SiteAdminConfig;
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
  try {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(DATA_FILE, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  } catch {
    // File persistence is best-effort (read-only / serverless hosts may fail).
  }
}

export async function loadSiteAdminConfig(): Promise<SiteAdminConfig> {
  const memory = memoryStore();
  if (memory) return memory;

  const persisted = await readPersistedConfig();
  const config = persisted ?? createDefaultSiteAdminConfig();
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
  setMemoryStore(next);
  await writePersistedConfig(next);
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
