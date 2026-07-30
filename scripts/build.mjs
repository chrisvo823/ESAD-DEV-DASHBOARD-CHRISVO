#!/usr/bin/env node
/**
 * Dual-host build entrypoint.
 *
 * - OpenAI Sites / Cloudflare Workers: `vinext build` → dist/
 * - Firebase App Hosting: the Next.js adapter sets NEXT_PRIVATE_STANDALONE=true
 *   before invoking `npm run build`, and then reads
 *   `.next/standalone/.next/routes-manifest.json`. Use `next build` in that case.
 */
import { spawnSync } from "node:child_process";

const useNextStandalone = process.env.NEXT_PRIVATE_STANDALONE === "true";
const command = useNextStandalone ? "next" : "vinext";
const label = useNextStandalone
  ? "next build (Firebase App Hosting standalone)"
  : "vinext build (Sites / Cloudflare)";

console.log(`[build] ${label}`);

const result = spawnSync(command, ["build"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env,
});

if (result.error) {
  console.error(`[build] failed to start ${command}:`, result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
