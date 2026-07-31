/**
 * Public Firebase web app config (safe to expose to the browser).
 *
 * Resolution order:
 * 1) FIREBASE_WEB_CONFIG / NEXT_PUBLIC_FIREBASE_WEB_CONFIG JSON
 * 2) FIREBASE_WEBAPP_CONFIG JSON (Firebase App Hosting auto-injects at BUILD)
 * 3) Individual NEXT_PUBLIC_FIREBASE_* vars
 *
 * On App Hosting, next.config.mjs also maps FIREBASE_WEBAPP_CONFIG onto
 * NEXT_PUBLIC_FIREBASE_* so the client bundle receives the values.
 */

export type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  messagingSenderId?: string;
  storageBucket?: string;
};

function readEnvValue(key: string): string | undefined {
  const fromProcess = process.env[key]?.trim();
  if (fromProcess) return fromProcess;
  const fromGlobal = (globalThis as Record<string, unknown>)[key];
  return typeof fromGlobal === "string" && fromGlobal.trim()
    ? fromGlobal.trim()
    : undefined;
}

function parseFirebaseWebConfigJson(
  raw: string | undefined,
): FirebaseWebConfig | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const apiKey =
      (typeof parsed.apiKey === "string" && parsed.apiKey.trim()) ||
      (typeof parsed.api_key === "string" && parsed.api_key.trim()) ||
      "";
    const authDomain =
      (typeof parsed.authDomain === "string" && parsed.authDomain.trim()) ||
      (typeof parsed.auth_domain === "string" && parsed.auth_domain.trim()) ||
      "";
    const projectId =
      (typeof parsed.projectId === "string" && parsed.projectId.trim()) ||
      (typeof parsed.project_id === "string" && parsed.project_id.trim()) ||
      "";
    const appId =
      (typeof parsed.appId === "string" && parsed.appId.trim()) ||
      (typeof parsed.app_id === "string" && parsed.app_id.trim()) ||
      "";
    if (!apiKey || !authDomain || !projectId || !appId) return null;
    const messagingSenderId =
      (typeof parsed.messagingSenderId === "string" &&
        parsed.messagingSenderId.trim()) ||
      (typeof parsed.messaging_sender_id === "string" &&
        parsed.messaging_sender_id.trim()) ||
      undefined;
    const storageBucket =
      (typeof parsed.storageBucket === "string" &&
        parsed.storageBucket.trim()) ||
      (typeof parsed.storage_bucket === "string" &&
        parsed.storage_bucket.trim()) ||
      undefined;
    return {
      apiKey,
      authDomain,
      projectId,
      appId,
      messagingSenderId: messagingSenderId || undefined,
      storageBucket: storageBucket || undefined,
    };
  } catch {
    return null;
  }
}

/** Resolve Firebase web config from process/env bindings (server or build-time). */
export function readFirebaseWebConfigFromEnv(): FirebaseWebConfig | null {
  const fromJson = parseFirebaseWebConfigJson(
    readEnvValue("FIREBASE_WEB_CONFIG") ??
      readEnvValue("NEXT_PUBLIC_FIREBASE_WEB_CONFIG") ??
      // Firebase App Hosting system env (BUILD by default; may also be RUNTIME
      // when overridden in the console / apphosting.yaml).
      readEnvValue("FIREBASE_WEBAPP_CONFIG"),
  );
  if (fromJson) return fromJson;

  const apiKey = readEnvValue("NEXT_PUBLIC_FIREBASE_API_KEY");
  const authDomain = readEnvValue("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
  const projectId = readEnvValue("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  const appId = readEnvValue("NEXT_PUBLIC_FIREBASE_APP_ID");
  if (!apiKey || !authDomain || !projectId || !appId) return null;

  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    messagingSenderId:
      readEnvValue("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID") || undefined,
    storageBucket:
      readEnvValue("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET") || undefined,
  };
}

export function isFirebaseWebConfig(
  value: unknown,
): value is FirebaseWebConfig {
  if (!value || typeof value !== "object") return false;
  const cfg = value as Record<string, unknown>;
  return (
    typeof cfg.apiKey === "string" &&
    Boolean(cfg.apiKey.trim()) &&
    typeof cfg.authDomain === "string" &&
    Boolean(cfg.authDomain.trim()) &&
    typeof cfg.projectId === "string" &&
    Boolean(cfg.projectId.trim()) &&
    typeof cfg.appId === "string" &&
    Boolean(cfg.appId.trim())
  );
}
