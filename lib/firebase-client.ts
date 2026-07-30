"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  isFirebaseWebConfig,
  readFirebaseWebConfigFromEnv,
  type FirebaseWebConfig,
} from "./firebase-web-config";

export type { FirebaseWebConfig };

declare global {
  interface Window {
    __ESAD_FIREBASE_CONFIG__?: FirebaseWebConfig | null;
  }
}

let runtimeConfig: FirebaseWebConfig | null | undefined;
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let hydratePromise: Promise<FirebaseWebConfig | null> | null = null;

function readInjectedWindowConfig(): FirebaseWebConfig | null {
  if (typeof window === "undefined") return null;
  const injected = window.__ESAD_FIREBASE_CONFIG__;
  return isFirebaseWebConfig(injected) ? injected : null;
}

/** Apply config discovered at runtime (layout inject / API). */
export function configureFirebaseWebConfig(
  config: FirebaseWebConfig | null | undefined,
): void {
  if (!isFirebaseWebConfig(config)) return;
  runtimeConfig = config;
  if (typeof window !== "undefined") {
    window.__ESAD_FIREBASE_CONFIG__ = config;
  }
  // Reset app/auth so the next getFirebaseAuth() uses the new config.
  app = null;
  auth = null;
}

export function getFirebaseWebConfig(): FirebaseWebConfig | null {
  if (runtimeConfig !== undefined) return runtimeConfig;
  const injected = readInjectedWindowConfig();
  if (injected) {
    runtimeConfig = injected;
    return injected;
  }
  const fromEnv = readFirebaseWebConfigFromEnv();
  runtimeConfig = fromEnv;
  return fromEnv;
}

/**
 * Ensure Firebase web config is available (env → window inject → public API).
 * Call before sign-in when build-time NEXT_PUBLIC_* may be missing.
 */
export async function ensureFirebaseWebConfig(): Promise<FirebaseWebConfig | null> {
  const existing = getFirebaseWebConfig();
  if (existing) return existing;
  if (typeof window === "undefined") return null;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const response = await fetch("/api/firebase-web-config", {
          cache: "no-store",
        });
        if (!response.ok) return null;
        const payload = (await response.json()) as {
          config?: FirebaseWebConfig | null;
        };
        if (isFirebaseWebConfig(payload.config)) {
          configureFirebaseWebConfig(payload.config);
          return payload.config;
        }
      } catch {
        return null;
      }
      return null;
    })().finally(() => {
      hydratePromise = null;
    });
  }
  return hydratePromise;
}

export function getFirebaseAuth(): Auth | null {
  const config = getFirebaseWebConfig();
  if (!config) return null;

  if (!app) {
    app = getApps()[0] ?? initializeApp(config);
  }
  if (!auth) {
    auth = getAuth(app);
  }
  return auth;
}

/** Resolve Auth after hydrating runtime Firebase config if needed. */
export async function ensureFirebaseAuth(): Promise<Auth | null> {
  await ensureFirebaseWebConfig();
  return getFirebaseAuth();
}
