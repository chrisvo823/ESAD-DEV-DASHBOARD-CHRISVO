import { readFileSync } from "node:fs";
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

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  vars: {
    ...(smartsheetAccessToken
      ? { SMARTSHEET_ACCESS_TOKEN: smartsheetAccessToken }
      : {}),
    ...googleSheetVars,
    ...adminVars,
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

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});
