"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useAdminAuthenticated } from "./admin-auth";
import {
  changeAdminPassword,
  resetAdminPassword,
  useAdminCredentials,
} from "./admin-credentials-store";

type AdminAccountPanelProps = {
  fallbackPassword: string;
};

type Mode = "change" | "reset";

export function AdminAccountPanel({ fallbackPassword }: AdminAccountPanelProps) {
  const authenticated = useAdminAuthenticated();
  const credentials = useAdminCredentials(fallbackPassword);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<Mode>("change");
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const titleId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!authenticated) setOpen(false);
  }, [authenticated]);

  useEffect(() => {
    if (!open) return;
    setEmail(credentials.recoveryEmail);
    setError(null);
    setMessage(null);
    setCurrentPassword("");
    setNextPassword("");
    setConfirmPassword("");
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, credentials.recoveryEmail]);

  if (!authenticated) return null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (nextPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    if (mode === "change") {
      const result = changeAdminPassword({
        fallbackPassword,
        currentPassword,
        nextPassword,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Password updated.");
      setCurrentPassword("");
      setNextPassword("");
      setConfirmPassword("");
      return;
    }

    const result = resetAdminPassword({
      fallbackPassword,
      email,
      nextPassword,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(
      credentials.recoveryEmail
        ? "Password reset with recovery email."
        : "Password reset. Recovery email saved for future resets.",
    );
    setNextPassword("");
    setConfirmPassword("");
  }

  return (
    <>
      <button
        type="button"
        className="config-window-trigger"
        onClick={() => setOpen(true)}
      >
        Account
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
                className="config-window admin-account-window"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
              >
                <header className="config-window-header">
                  <div>
                    <p className="config-window-kicker">Admin account</p>
                    <h3 id={titleId}>Password change &amp; reset</h3>
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

                <div className="admin-account-modes" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "change"}
                    className={`admin-account-mode${
                      mode === "change" ? " admin-account-mode--active" : ""
                    }`}
                    onClick={() => {
                      setMode("change");
                      setError(null);
                      setMessage(null);
                    }}
                  >
                    Change password
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "reset"}
                    className={`admin-account-mode${
                      mode === "reset" ? " admin-account-mode--active" : ""
                    }`}
                    onClick={() => {
                      setMode("reset");
                      setError(null);
                      setMessage(null);
                    }}
                  >
                    Reset password
                  </button>
                </div>

                <form className="admin-account-form" onSubmit={handleSubmit}>
                  {mode === "change" ? (
                    <label className="admin-login-field">
                      <span>Current password</span>
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={(event) =>
                          setCurrentPassword(event.target.value)
                        }
                      />
                    </label>
                  ) : (
                    <label className="admin-login-field">
                      <span>Recovery email</span>
                      <input
                        type="email"
                        autoComplete="email"
                        placeholder="ops@example.com"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                      />
                    </label>
                  )}

                  {mode === "reset" ? (
                    <p className="config-window-help">
                      {credentials.recoveryEmail
                        ? "Enter the saved recovery email, then choose a new password."
                        : "First reset: enter an email to save as recovery contact, then set a new password."}
                    </p>
                  ) : null}

                  <label className="admin-login-field">
                    <span>New password</span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={nextPassword}
                      onChange={(event) => setNextPassword(event.target.value)}
                    />
                  </label>
                  <label className="admin-login-field">
                    <span>Confirm new password</span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                    />
                  </label>

                  {error ? <p className="admin-login-error">{error}</p> : null}
                  {message ? (
                    <p className="config-window-saved">{message}</p>
                  ) : null}

                  <button type="submit" className="admin-login-submit">
                    {mode === "change" ? "Update password" : "Reset password"}
                  </button>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
