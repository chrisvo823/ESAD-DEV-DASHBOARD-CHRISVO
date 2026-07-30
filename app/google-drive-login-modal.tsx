"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { getAllowedEmailDomain } from "../lib/allowed-email";
import {
  ensureFirebaseAuth,
  getFirebaseWebConfig,
} from "../lib/firebase-client";
import { signInWithGoogleDriveAccess } from "./ensure-google-drive-access";

type GoogleDriveLoginModalProps = {
  reason?: string;
  onSuccess: () => void;
  onCancel: () => void;
};

export function GoogleDriveLoginModal({
  reason,
  onSuccess,
  onCancel,
}: GoogleDriveLoginModalProps) {
  const titleId = useId();
  const allowedDomain = getAllowedEmailDomain();
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firebaseReady, setFirebaseReady] = useState<boolean | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const auth = await ensureFirebaseAuth();
      if (!cancelled) setFirebaseReady(Boolean(auth && getFirebaseWebConfig()));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onCancel]);

  async function handleSignIn() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogleDriveAccess({ forceConsent: true });
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Google Drive sign-in failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="drive-login-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        className="drive-login-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="drive-login-header">
          <div>
            <p className="drive-login-kicker">Google Drive</p>
            <h3 id={titleId}>Sign in to load config files</h3>
          </div>
          <button
            type="button"
            className="config-window-close"
            onClick={onCancel}
          >
            Cancel
          </button>
        </header>
        <div className="drive-login-body">
          <p>
            {reason?.trim() ||
              "Connect your Google account with Drive access to list and load configuration Docs from the shared Admin folder."}
          </p>
          <p className="drive-login-meta">
            Use an <strong>@{allowedDomain}</strong> account. You will be asked
            to allow Docs and Drive read access.
          </p>
          {firebaseReady === false ? (
            <p className="drive-login-error" role="alert">
              Firebase Auth is not configured. Set{" "}
              <code>NEXT_PUBLIC_FIREBASE_*</code> or{" "}
              <code>FIREBASE_WEB_CONFIG</code> on the host, then reload.
            </p>
          ) : null}
          {error ? (
            <p className="drive-login-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <footer className="drive-login-footer">
          <button
            type="button"
            className="config-window-close"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="config-window-load"
            disabled={busy || firebaseReady === false}
            onClick={() => void handleSignIn()}
          >
            {busy ? "Opening Google…" : "Sign in with Google Drive"}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
