"use client";

import { useState, type FormEvent } from "react";
import {
  setAdminAuthenticated,
  useAdminAuthenticated,
} from "./admin-auth";
import {
  readAdminCredentials,
  resetAdminPassword,
  useAdminCredentials,
} from "./admin-credentials-store";

type AdminLoginProps = {
  username: string;
  password: string;
};

type PanelMode = "login" | "reset";

export function AdminLogin({ username, password }: AdminLoginProps) {
  const authenticated = useAdminAuthenticated();
  const credentials = useAdminCredentials(password);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PanelMode>("login");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [email, setEmail] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function resetFormState() {
    setError(null);
    setMessage(null);
    setPass("");
    setNextPassword("");
    setConfirmPassword("");
  }

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const activePassword = readAdminCredentials(password).password;
    if (user.trim() === username && pass === activePassword) {
      setAdminAuthenticated(true);
      resetFormState();
      setOpen(false);
      setMode("login");
      return;
    }
    setError("Invalid credentials");
  }

  function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (nextPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    const result = resetAdminPassword({
      fallbackPassword: password,
      email,
      nextPassword,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage("Password reset. Sign in with the new password.");
    setMode("login");
    setPass("");
    setNextPassword("");
    setConfirmPassword("");
  }

  function handleLogout() {
    setAdminAuthenticated(false);
    setOpen(false);
    setMode("login");
    setUser("");
    resetFormState();
  }

  return (
    <div className="admin-login">
      {authenticated ? (
        <div className="admin-login-status">
          <span className="admin-login-badge">Admin</span>
          <button
            type="button"
            className="admin-login-button"
            onClick={handleLogout}
          >
            Log out
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="admin-login-button"
            aria-expanded={open}
            onClick={() => {
              setOpen((value) => !value);
              setMode("login");
              resetFormState();
              setEmail(credentials.recoveryEmail);
            }}
          >
            Admin login
          </button>
          {open ? (
            mode === "login" ? (
              <form className="admin-login-panel" onSubmit={handleLogin}>
                <p className="admin-login-title">Admin credentials</p>
                <label className="admin-login-field">
                  <span>Username</span>
                  <input
                    name="username"
                    autoComplete="username"
                    value={user}
                    onChange={(event) => setUser(event.target.value)}
                  />
                </label>
                <label className="admin-login-field">
                  <span>Password</span>
                  <input
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={pass}
                    onChange={(event) => setPass(event.target.value)}
                  />
                </label>
                {message ? (
                  <p className="config-window-saved">{message}</p>
                ) : null}
                {error ? <p className="admin-login-error">{error}</p> : null}
                <button type="submit" className="admin-login-submit">
                  Sign in
                </button>
                <button
                  type="button"
                  className="admin-login-link"
                  onClick={() => {
                    setMode("reset");
                    resetFormState();
                    setEmail(credentials.recoveryEmail);
                  }}
                >
                  Reset password
                </button>
              </form>
            ) : (
              <form className="admin-login-panel" onSubmit={handleReset}>
                <p className="admin-login-title">Reset password</p>
                <label className="admin-login-field">
                  <span>Recovery email</span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>
                <p className="admin-login-hint">
                  {credentials.recoveryEmail
                    ? "Enter the saved recovery email, then choose a new password."
                    : "First reset: enter an email to save as recovery contact."}
                </p>
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
                <button type="submit" className="admin-login-submit">
                  Reset password
                </button>
                <button
                  type="button"
                  className="admin-login-link"
                  onClick={() => {
                    setMode("login");
                    resetFormState();
                  }}
                >
                  Back to sign in
                </button>
              </form>
            )
          ) : null}
        </>
      )}
    </div>
  );
}
