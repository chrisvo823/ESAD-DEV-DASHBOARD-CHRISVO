import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

function readEnvFileValue(key: string): string | undefined {
  try {
    const envText = readFileSync(new URL("./.env", import.meta.url), "utf8");
    const match = envText.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+)\\s*$`, "m"));
    return match?.[1]?.trim();
  } catch {
    return undefined;
  }
}

const smartsheetAccessToken =
  process.env.SMARTSHEET_ACCESS_TOKEN ?? readEnvFileValue("SMARTSHEET_ACCESS_TOKEN");

if (smartsheetAccessToken) {
  process.env.SMARTSHEET_ACCESS_TOKEN = smartsheetAccessToken;
}

const googleSheetEnvKeys = [
  "ESAD_GOOGLE_SHEET_ID_DSB",
  "ESAD_GOOGLE_SHEET_ID_HVFB",
  "ESAD_GOOGLE_SHEET_ID_PRI",
  "ESAD_GOOGLE_SHEET_ID_IND",
] as const;

const googleSheetVars: Record<string, string> = {};
for (const key of googleSheetEnvKeys) {
  const value = process.env[key] ?? readEnvFileValue(key);
  if (value) {
    process.env[key] = value;
    googleSheetVars[key] = value;
  }
}

const adminEnvKeys = ["ADMIN_USERNAME", "ADMIN_PASSWORD"] as const;
const adminVars: Record<string, string> = {};
for (const key of adminEnvKeys) {
  const value = process.env[key] ?? readEnvFileValue(key);
  if (value) {
    process.env[key] = value;
    adminVars[key] = value;
  }
}

const googleDocsEnvKeys = [
  "GOOGLE_DOCS_ACCESS_TOKEN",
  "GOOGLE_SERVICE_ACCOUNT_JSON",
] as const;
const googleDocsVars: Record<string, string> = {};
for (const key of googleDocsEnvKeys) {
  const value = process.env[key] ?? readEnvFileValue(key);
  if (value) {
    process.env[key] = value;
    googleDocsVars[key] = value;
  }
}

// Public Firebase web config — needed at runtime in the worker (layout inject /
// /api/firebase-web-config) and for vinext NEXT_PUBLIC_* inlining.
const firebaseEnvKeys = [
  "FIREBASE_WEB_CONFIG",
  "NEXT_PUBLIC_FIREBASE_WEB_CONFIG",
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN",
] as const;
const firebaseVars: Record<string, string> = {};
for (const key of firebaseEnvKeys) {
  const value = process.env[key] ?? readEnvFileValue(key);
  if (value) {
    process.env[key] = value;
    firebaseVars[key] = value;
  }
}

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

/**
 * Local vinext/workerd often cannot write the repo `.data/` directory (EPERM).
 * Seed Admin/Card config into a writable temp dir and pass the path into the
 * Worker so Desktop / localhost preview shows Smartsheet-backed cards.
 */
const localSiteConfigDir =
  process.env.ESAD_SITE_CONFIG_DIR?.trim() ||
  path.join(os.tmpdir(), "esad-dashboard-data");
const repoSiteConfigFile = path.join(
  process.cwd(),
  ".data",
  "admin-site-config.json",
);
const localSiteConfigFile = path.join(
  localSiteConfigDir,
  "admin-site-config.json",
);
try {
  mkdirSync(localSiteConfigDir, { recursive: true });
  // Prefer the repo host snapshot whenever present so local preview picks up
  // Card Configuration links (Smartsheet / Google Drive) after a fresh boot.
  if (existsSync(repoSiteConfigFile)) {
    copyFileSync(repoSiteConfigFile, localSiteConfigFile);
  }
} catch {
  // Best-effort seed; Worker falls back to empty compiled slots if missing.
}
process.env.ESAD_SITE_CONFIG_DIR = localSiteConfigDir;

// Wrangler/miniflare injects `.env` / `.dev.vars` into the Worker `process.env`.
// Plain `vars` in the Cloudflare Vite plugin are not always mirrored there.
function ensureLocalEnvKey(filePath: string, key: string, value: string): void {
  try {
    const existing = existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^\\s*${key}\\s*=.*$`, "m");
    if (pattern.test(existing)) {
      writeFileSync(filePath, existing.replace(pattern, line), "utf8");
    } else {
      const prefix =
        existing.length === 0 || existing.endsWith("\n") ? "" : "\n";
      appendFileSync(filePath, `${prefix}${line}\n`, "utf8");
    }
  } catch {
    // Ignore — preview still works when the host seed is readable another way.
  }
}
ensureLocalEnvKey(
  path.join(process.cwd(), ".env"),
  "ESAD_SITE_CONFIG_DIR",
  localSiteConfigDir,
);
ensureLocalEnvKey(
  path.join(process.cwd(), ".dev.vars"),
  "ESAD_SITE_CONFIG_DIR",
  localSiteConfigDir,
);

const localBindingConfig = {
  main: "./worker/index.ts",
  // populate_process_env mirrors Site/Wrangler secrets onto process.env so
  // SMARTSHEET_ACCESS_TOKEN (and other bindings) work in app server code.
  compatibility_flags: ["nodejs_compat", "nodejs_compat_populate_process_env"],
  vars: {
    ESAD_SITE_CONFIG_DIR: localSiteConfigDir,
    ...(smartsheetAccessToken
      ? { SMARTSHEET_ACCESS_TOKEN: smartsheetAccessToken }
      : {}),
    ...googleSheetVars,
    ...adminVars,
    ...googleDocsVars,
    ...firebaseVars,
  },
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

async function seedWorkerSiteConfigFromRepo(port: number): Promise<void> {
  if (!existsSync(repoSiteConfigFile)) return;
  try {
    const disk = JSON.parse(readFileSync(repoSiteConfigFile, "utf8")) as {
      dashboardConfigs?: Record<string, unknown>;
      adminCredentials?: { password?: string };
    };
    const password =
      disk.adminCredentials?.password?.trim() ||
      process.env.ADMIN_PASSWORD?.trim() ||
      "esad";
    if (!disk.dashboardConfigs) return;

    // Wait briefly for vinext/workerd to accept requests after listen.
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      try {
        const response = await fetch(`http://localhost:${port}/api/site-config`, {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            "x-esad-admin-password": password,
          },
          body: JSON.stringify({ dashboardConfigs: disk.dashboardConfigs }),
        });
        if (response.ok) return;
      } catch {
        // Server not ready yet.
      }
    }
  } catch {
    // Preview still boots; cards stay empty until Admin Load Config.
  }
}

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    // Bind all interfaces so Cursor Desktop / port-forward preview can connect.
    server: {
      host: "0.0.0.0",
      port: 3000,
      strictPort: true,
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
      {
        name: "esad-seed-local-site-config",
        configureServer(server) {
          const port = Number(server.config.server.port ?? 3000);
          server.httpServer?.once("listening", () => {
            void seedWorkerSiteConfigFromRepo(port);
          });
        },
      },
    ],
  };
});
