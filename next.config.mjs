/**
 * Map Firebase App Hosting's auto-injected FIREBASE_WEBAPP_CONFIG (BUILD only)
 * onto NEXT_PUBLIC_FIREBASE_* so the client Auth SDK and layout inject work
 * without manually duplicating Project settings → Your apps → Web app.
 *
 * @param {string | undefined} raw
 * @returns {Record<string, string>}
 */
function publicFirebaseEnvFromWebappConfig(raw) {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    /** @type {Record<string, unknown>} */
    const cfg = parsed;
    const apiKey =
      (typeof cfg.apiKey === "string" && cfg.apiKey.trim()) ||
      (typeof cfg.api_key === "string" && cfg.api_key.trim()) ||
      "";
    const authDomain =
      (typeof cfg.authDomain === "string" && cfg.authDomain.trim()) ||
      (typeof cfg.auth_domain === "string" && cfg.auth_domain.trim()) ||
      "";
    const projectId =
      (typeof cfg.projectId === "string" && cfg.projectId.trim()) ||
      (typeof cfg.project_id === "string" && cfg.project_id.trim()) ||
      "";
    const appId =
      (typeof cfg.appId === "string" && cfg.appId.trim()) ||
      (typeof cfg.app_id === "string" && cfg.app_id.trim()) ||
      "";
    if (!apiKey || !authDomain || !projectId || !appId) return {};

    /** @type {Record<string, string>} */
    const env = {
      NEXT_PUBLIC_FIREBASE_API_KEY: apiKey,
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: authDomain,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: projectId,
      NEXT_PUBLIC_FIREBASE_APP_ID: appId,
    };
    const messagingSenderId =
      (typeof cfg.messagingSenderId === "string" &&
        cfg.messagingSenderId.trim()) ||
      (typeof cfg.messaging_sender_id === "string" &&
        cfg.messaging_sender_id.trim()) ||
      "";
    const storageBucket =
      (typeof cfg.storageBucket === "string" && cfg.storageBucket.trim()) ||
      (typeof cfg.storage_bucket === "string" && cfg.storage_bucket.trim()) ||
      "";
    if (messagingSenderId) {
      env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = messagingSenderId;
    }
    if (storageBucket) {
      env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = storageBucket;
    }
    return env;
  } catch {
    return {};
  }
}

const fromWebappConfig = publicFirebaseEnvFromWebappConfig(
  process.env.FIREBASE_WEBAPP_CONFIG ?? process.env.FIREBASE_WEB_CONFIG,
);

// Prefer explicitly set NEXT_PUBLIC_* (console / .env) over mapped values.
/** @type {Record<string, string>} */
const firebaseEnv = {};
for (const [key, value] of Object.entries(fromWebappConfig)) {
  if (!process.env[key]?.trim()) {
    firebaseEnv[key] = value;
    process.env[key] = value;
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Firebase App Hosting's Next.js adapter (standalone bundle).
  output: "standalone",
  // Keep this file as .mjs: Firebase's adapter emits ESM overrides for .mjs,
  // but CommonJS `module.exports` for .ts (breaks under "type": "module").
  images: {
    unoptimized: true,
  },
  // Bake public Firebase web config into the Next bundle at build time.
  env: firebaseEnv,
};

export default nextConfig;
