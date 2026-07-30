"use client";

import {
  GoogleAuthProvider,
  reauthenticateWithPopup,
  signInWithPopup,
} from "firebase/auth";
import { getAllowedEmailDomain } from "../lib/allowed-email";
import { getFirebaseAuth } from "../lib/firebase-client";
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

/**
 * Ensure a Google OAuth access token with Docs/Drive scopes is available.
 * Uses the existing session token when present; otherwise prompts Google.
 */
export async function ensureGoogleDriveAccessToken(): Promise<string> {
  const existing = getGoogleAccessToken();
  if (existing) return existing;

  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error(
      "Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* env vars, or configure GOOGLE_SERVICE_ACCOUNT_JSON on the server.",
    );
  }

  const provider = buildGoogleProvider(true);
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
