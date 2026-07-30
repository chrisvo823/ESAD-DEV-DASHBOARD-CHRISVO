"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  getAllowedEmailDomain,
  isAllowedCompanyEmail,
} from "../lib/allowed-email";
import {
  ensureFirebaseAuth,
  ensureFirebaseWebConfig,
  getFirebaseAuth,
  getFirebaseWebConfig,
} from "../lib/firebase-client";
import { recordDashboardLogin } from "../lib/record-dashboard-login";
import { setGoogleAccessToken } from "./google-access-token";
import { refreshSiteConfigFromHost } from "./site-config-client";

type CompanyAuthGateProps = {
  children: ReactNode;
  /** Host Dashboard Configuration title for the sign-in screen. */
  dashboardName?: string;
};

type GateState =
  | { status: "loading" }
  | { status: "missing-config" }
  | { status: "signed-out" }
  | { status: "blocked"; email: string }
  | { status: "ready"; user: User };

export function CompanyAuthGate({
  children,
  dashboardName,
}: CompanyAuthGateProps) {
  const allowedDomain = useMemo(() => getAllowedEmailDomain(), []);
  const signInTitle = dashboardName?.trim() || "Engineering Dashboard";
  const [state, setState] = useState<GateState>({ status: "loading" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;

    void (async () => {
      await ensureFirebaseWebConfig();
      if (cancelled) return;
      const auth = await ensureFirebaseAuth();
      if (cancelled) return;
      if (!auth || !getFirebaseWebConfig()) {
        setState({ status: "missing-config" });
        return;
      }

      unsub = onAuthStateChanged(auth, async (user) => {
        setError(null);
        if (!user) {
          setState({ status: "signed-out" });
          return;
        }

        if (!isAllowedCompanyEmail(user.email, allowedDomain)) {
          setState({ status: "blocked", email: user.email ?? "(no email)" });
          await signOut(auth);
          return;
        }

        setState({ status: "ready", user });
        void recordDashboardLogin(user.email);
        void refreshSiteConfigFromHost();
      });
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [allowedDomain]);

  async function handleGoogleSignIn() {
    setBusy(true);
    setError(null);
    try {
      const auth = (await ensureFirebaseAuth()) ?? getFirebaseAuth();
      if (!auth) {
        setState({ status: "missing-config" });
        return;
      }
      const provider = new GoogleAuthProvider();
      // Docs + Drive scopes let Admin list/load configuration files from Drive.
      provider.addScope("https://www.googleapis.com/auth/documents");
      provider.addScope("https://www.googleapis.com/auth/drive.readonly");
      provider.setCustomParameters({
        hd: allowedDomain,
        // Consent ensures Drive scopes are granted (not only Firebase Auth).
        prompt: "consent select_account",
      });
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      setGoogleAccessToken(credential?.accessToken ?? null);
      if (!isAllowedCompanyEmail(result.user.email, allowedDomain)) {
        setGoogleAccessToken(null);
        await signOut(auth);
        setState({
          status: "blocked",
          email: result.user.email ?? "(no email)",
        });
      } else {
        void recordDashboardLogin(result.user.email);
        void refreshSiteConfigFromHost();
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Google sign-in failed.";
      setError(message);
      setState({ status: "signed-out" });
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    const auth = getFirebaseAuth();
    if (!auth) return;
    setBusy(true);
    try {
      setGoogleAccessToken(null);
      await signOut(auth);
    } finally {
      setBusy(false);
    }
  }

  if (state.status === "ready") {
    return (
      <>
        <div className="company-auth-bar">
          <span className="company-auth-user">
            Signed in as <strong>{state.user.email}</strong>
          </span>
          <button
            type="button"
            className="company-auth-signout"
            onClick={handleSignOut}
            disabled={busy}
          >
            Sign out
          </button>
        </div>
        {children}
      </>
    );
  }

  // Local / preview hosts without Firebase env still show the dashboard so
  // Current Task, Next Task, and card Configuration can be inspected.
  if (state.status === "missing-config") {
    return (
      <>
        <div className="company-auth-bar company-auth-bar--preview" role="status">
          <span className="company-auth-user">
            Preview mode — Firebase Auth is not configured
          </span>
        </div>
        {children}
      </>
    );
  }

  return (
    <main className="company-auth-shell">
      <section className="company-auth-card" aria-label="Company sign in">
        <img
          className="company-auth-logo"
          src="/mach-industries-logo.png"
          alt="Mach Industries"
          width={72}
          height={72}
        />
        <h1>{signInTitle}</h1>
        <p>
          Sign in with your <strong>@{allowedDomain}</strong> Google account to
          continue.
        </p>

        {state.status === "blocked" ? (
          <p className="company-auth-error">
            {state.email} is not allowed. Use an @{allowedDomain} account.
          </p>
        ) : null}

        {error ? <p className="company-auth-error">{error}</p> : null}

        <button
          type="button"
          className="company-auth-google"
          onClick={handleGoogleSignIn}
          disabled={busy || state.status === "loading"}
        >
          {busy || state.status === "loading"
            ? "Working…"
            : "Sign in with Google"}
        </button>
      </section>
    </main>
  );
}
