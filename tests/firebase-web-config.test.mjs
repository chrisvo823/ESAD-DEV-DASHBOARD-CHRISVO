import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("firebase web config supports env vars and JSON blob", async () => {
  const source = await readFile(
    new URL("../lib/firebase-web-config.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /export function readFirebaseWebConfigFromEnv/);
  assert.match(source, /FIREBASE_WEB_CONFIG/);
  assert.match(source, /NEXT_PUBLIC_FIREBASE_API_KEY/);
  assert.match(source, /NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN/);
  assert.match(source, /NEXT_PUBLIC_FIREBASE_PROJECT_ID/);
  assert.match(source, /NEXT_PUBLIC_FIREBASE_APP_ID/);
});

test("firebase client hydrates from layout inject and public API", async () => {
  const [client, api, layout, vite, authGate, driveLogin] = await Promise.all([
    readFile(new URL("../lib/firebase-client.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/api/firebase-web-config/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/company-auth-gate.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/google-drive-login-modal.tsx", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(client, /ensureFirebaseWebConfig/);
  assert.match(client, /ensureFirebaseAuth/);
  assert.match(client, /configureFirebaseWebConfig/);
  assert.match(api, /readFirebaseWebConfigFromEnv/);
  assert.doesNotMatch(api, /status:\s*503/);
  assert.match(api, /config:\s*null/);
  assert.match(layout, /__ESAD_FIREBASE_CONFIG__/);
  assert.match(vite, /firebaseVars/);
  assert.match(vite, /NEXT_PUBLIC_FIREBASE_API_KEY/);
  assert.match(authGate, /ensureFirebaseWebConfig/);
  assert.match(authGate, /ensureFirebaseAuth/);
  assert.match(authGate, /Checking Google sign-in/);
  assert.match(authGate, /Preview mode — Firebase Auth is not configured/);
  assert.match(driveLogin, /Sign in with Google Drive/);
  assert.match(driveLogin, /drive-login-modal/);
});
