"use client";

import { createElement } from "react";
import { createRoot } from "react-dom/client";
import {
  GoogleAuthProvider,
  reauthenticateWithPopup,
  signInWithPopup,
} from "firebase/auth";
import { getAllowedEmailDomain } from "../lib/allowed-email";
import {
  ensureFirebaseAuth,
  getFirebaseWebConfig,
} from "../lib/firebase-client";
import { GoogleDriveLoginModal } from "./google-drive-login-modal";
import {
  getGoogleAccessToken,
  setGoogleAccessToken,
} from "./google-access-token";

const DOCS_SCOPE = "https://www.googleapis.com/auth/documents";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

function buildGoogleProvider(forceConsent: boolean): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.addScope(DOCS_SCOPE);
  provider.addScope(DRIVE_SCOPE);
  provider.setCustomParameters({
    hd: getAllowedEmailDomain(),
    prompt: forceConsent ? "consent select_account" : "select_account",
  });
  return provider;
}

export type SignInWithGoogleDriveOptions = {
  forceConsent?: boolean;
};

/**
 * Firebase Google sign-in / reauth that requests Docs + Drive scopes and
 * stores the OAuth access token for Admin Load Config.
 */
export async function signInWithGoogleDriveAccess(
  options: SignInWithGoogleDriveOptions = {},
): Promise<string> {
  const auth = await ensureFirebaseAuth();
  if (!auth || !getFirebaseWebConfig()) {
    throw new Error(
      "Firebase Auth is not configured. Set NEXT_PUBLIC_FIREBASE_* or FIREBASE_WEB_CONFIG.",
    );
  }

  const provider = buildGoogleProvider(options.forceConsent ?? true);
  const user = auth.currentUser;
  const result = user
    ? await reauthenticateWithPopup(user, provider)
    : await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken?.trim() ?? "";
  setGoogleAccessToken(token || null);
  if (!token) {
    throw new Error(
      "Google did not return a Drive access token. Grant Docs and Drive access, then try again.",
    );
  }
  return token;
}

/**
 * Show the in-app Google Drive login popup, then complete Firebase Google
 * sign-in with Drive scopes. Resolves true on success, false if cancelled.
 */
export function showGoogleDriveLoginPopup(options?: {
  reason?: string;
}): Promise<boolean> {
  return new Promise((resolve) => {
    const host = document.createElement("div");
    host.setAttribute("data-google-drive-login-root", "1");
    document.body.appendChild(host);
    const root = createRoot(host);

    const finish = (ok: boolean) => {
      root.unmount();
      host.remove();
      resolve(ok);
    };

    root.render(
      createElement(GoogleDriveLoginModal, {
        reason: options?.reason,
        onSuccess: () => finish(true),
        onCancel: () => finish(false),
      }),
    );
  });
}

/**
 * Ensure a Google OAuth access token with Docs/Drive scopes is available.
 * Uses the existing session token when present; otherwise opens the Drive
 * login popup (which runs Firebase Google sign-in).
 */
export async function ensureGoogleDriveAccessToken(options?: {
  reason?: string;
  forcePopup?: boolean;
}): Promise<string> {
  const existing = getGoogleAccessToken();
  if (existing && !options?.forcePopup) return existing;

  const signedIn = await showGoogleDriveLoginPopup({
    reason: options?.reason,
  });
  if (!signedIn) {
    throw new Error("Google Drive sign-in was cancelled.");
  }

  const token = getGoogleAccessToken();
  if (!token) {
    throw new Error(
      "Google Drive access token missing after sign-in. Try again.",
    );
  }
  return token;
}
