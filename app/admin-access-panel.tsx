"use client";

import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  checkEmailAccess,
  getAllowedEmailDomain,
  isAllowedCompanyEmail,
  type EmailAccessCheck,
} from "../lib/allowed-email";
import { getFirebaseAuth, getFirebaseWebConfig } from "../lib/firebase-client";
import { useAdminAuthenticated } from "./admin-auth";

export function AdminAccessPanel() {
  const authenticated = useAdminAuthenticated();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [signedInUser, setSignedInUser] = useState<User | null>(null);
  const [emailDraft, setEmailDraft] = useState("");
  const [checkResult, setCheckResult] = useState<EmailAccessCheck | null>(null);
  const titleId = useId();
  const resultId = useId();

  const firebaseConfigured = useMemo(() => getFirebaseWebConfig() != null, []);
  const allowedDomain = useMemo(() => getAllowedEmailDomain(), []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!authenticated) setOpen(false);
  }, [authenticated]);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setSignedInUser(null);
      return;
    }
    return onAuthStateChanged(auth, (user) => {
      setSignedInUser(user);
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    setEmailDraft("");
    setCheckResult(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!authenticated) return null;

  function handleCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCheckResult(checkEmailAccess(emailDraft, allowedDomain));
  }

  const signedInAllowed = isAllowedCompanyEmail(
    signedInUser?.email,
    allowedDomain,
  );

  return (
    <>
      <button
        type="button"
        className="config-window-trigger"
        onClick={() => setOpen(true)}
      >
        Access
      </button>
      {mounted && open
        ? createPortal(
            <div
              className="config-window-backdrop"
              role="presentation"
              onClick={(event) => {
                if (event.target === event.currentTarget) setOpen(false);
              }}
            >
              <div
                className="config-window admin-access-window"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
              >
                <header className="config-window-header">
                  <div>
                    <p className="config-window-kicker">Admin access</p>
                    <h3 id={titleId}>Check user accesses</h3>
                  </div>
                  <div className="config-window-actions">
                    <button
                      type="button"
                      className="config-window-close"
                      onClick={() => setOpen(false)}
                    >
                      Close
                    </button>
                  </div>
                </header>

                <div className="admin-access-body">
                  <section
                    className="admin-access-section"
                    aria-label="Access policy"
                  >
                    <h4>Access policy</h4>
                    <dl className="admin-access-facts">
                      <div>
                        <dt>Allowed domain</dt>
                        <dd>@{allowedDomain}</dd>
                      </div>
                      <div>
                        <dt>Google Sign-In</dt>
                        <dd>
                          {firebaseConfigured ? (
                            <span className="admin-access-pill admin-access-pill--ok">
                              Configured
                            </span>
                          ) : (
                            <span className="admin-access-pill admin-access-pill--warn">
                              Preview mode
                            </span>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Who can open the dashboard</dt>
                        <dd>
                          {firebaseConfigured
                            ? `Any Google account ending in @${allowedDomain}`
                            : "Firebase is unset — dashboard is open in preview mode"}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <section
                    className="admin-access-section"
                    aria-label="Signed-in Google user"
                  >
                    <h4>Current Google session</h4>
                    {signedInUser?.email ? (
                      <dl className="admin-access-facts">
                        <div>
                          <dt>Signed in as</dt>
                          <dd>{signedInUser.email}</dd>
                        </div>
                        <div>
                          <dt>Access</dt>
                          <dd>
                            {signedInAllowed ? (
                              <span className="admin-access-pill admin-access-pill--ok">
                                Allowed
                              </span>
                            ) : (
                              <span className="admin-access-pill admin-access-pill--deny">
                                Denied
                              </span>
                            )}
                          </dd>
                        </div>
                      </dl>
                    ) : (
                      <p className="config-window-help">
                        {firebaseConfigured
                          ? "No Google user is signed in on this browser."
                          : "No Firebase session — preview mode does not require sign-in."}
                      </p>
                    )}
                  </section>

                  <section
                    className="admin-access-section"
                    aria-label="Check an email"
                  >
                    <h4>Check an email</h4>
                    <p className="config-window-help">
                      Enter a company email to see whether it would be allowed
                      through Google Sign-In.
                    </p>
                    <form className="admin-access-form" onSubmit={handleCheck}>
                      <label className="admin-login-field">
                        <span>Email</span>
                        <input
                          type="email"
                          autoComplete="email"
                          placeholder={`name@${allowedDomain}`}
                          value={emailDraft}
                          onChange={(event) => {
                            setEmailDraft(event.target.value);
                            setCheckResult(null);
                          }}
                          aria-describedby={
                            checkResult ? resultId : undefined
                          }
                        />
                      </label>
                      <button type="submit" className="admin-login-submit">
                        Check access
                      </button>
                    </form>

                    {checkResult ? (
                      <p
                        id={resultId}
                        className={`admin-access-result${
                          checkResult.allowed
                            ? " admin-access-result--ok"
                            : " admin-access-result--deny"
                        }`}
                        role="status"
                      >
                        <strong>
                          {checkResult.allowed ? "Allowed" : "Denied"}
                        </strong>
                        {checkResult.email ? (
                          <>
                            {" "}
                            for <code>{checkResult.email}</code>
                          </>
                        ) : null}
                        <span>{checkResult.reason}</span>
                      </p>
                    ) : null}
                  </section>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
