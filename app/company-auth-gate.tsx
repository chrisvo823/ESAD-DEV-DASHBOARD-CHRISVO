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
import { getFirebaseAuth, getFirebaseWebConfig } from "../lib/firebase-client";
import { recordDashboardLogin } from "../lib/record-dashboard-login";

type CompanyAuthGateProps = {
  children: ReactNode;
};

type GateState =
  | { status: "loading" }
  | { status: "missing-config" }
  | { status: "signed-out" }
  | { status: "blocked"; email: string }
  | { status: "ready"; user: User };

export function CompanyAuthGate({ children }: CompanyAuthGateProps) {
  const auth = useMemo(() => getFirebaseAuth(), []);
  const config = useMemo(() => getFirebaseWebConfig(), []);
  const allowedDomain = useMemo(() => getAllowedEmailDomain(), []);
  const [state, setState] = useState<GateState>(() =>
    config ? { status: "loading" } : { status: "missing-config" },
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!auth) {
      setState({ status: "missing-config" });
      return;
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
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
    });

    return () => unsub();
  }, [auth, allowedDomain]);

  async function handleGoogleSignIn() {
    if (!auth) return;
    setBusy(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        hd: allowedDomain,
        prompt: "select_account",
      });
      const result = await signInWithPopup(auth, provider);
      if (!isAllowedCompanyEmail(result.user.email, allowedDomain)) {
        await signOut(auth);
        setState({
          status: "blocked",
          email: result.user.email ?? "(no email)",
        });
      } else {
        void recordDashboardLogin(result.user.email);
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
    if (!auth) return;
    setBusy(true);
    try {
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
        <h1>MACH ESAD Dashboard</h1>
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
