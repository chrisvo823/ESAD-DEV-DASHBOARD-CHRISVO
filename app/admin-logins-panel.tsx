"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import {
  formatLoginActivityTime,
  type LoginActivitySummary,
} from "../lib/login-activity";
import { useAdminAuthenticated } from "./admin-auth";

type AdminLoginsPanelProps = {
  adminPassword: string;
};

export function AdminLoginsPanel({ adminPassword }: AdminLoginsPanelProps) {
  const authenticated = useAdminAuthenticated();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<LoginActivitySummary | null>(null);
  const titleId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!authenticated) setOpen(false);
  }, [authenticated]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open || !authenticated) return;

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/login-activity", {
          headers: {
            "x-esad-admin-password": adminPassword,
          },
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(
            response.status === 401
              ? "Admin authorization failed."
              : `Could not load login activity (${response.status}).`,
          );
        }
        const payload = (await response.json()) as LoginActivitySummary;
        if (!cancelled) setSummary(payload);
      } catch (err) {
        if (!cancelled) {
          setSummary(null);
          setError(err instanceof Error ? err.message : "Failed to load logins.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, authenticated, adminPassword]);

  if (!authenticated) return null;

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/login-activity", {
        headers: {
          "x-esad-admin-password": adminPassword,
        },
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? "Admin authorization failed."
            : `Could not load login activity (${response.status}).`,
        );
      }
      setSummary((await response.json()) as LoginActivitySummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load logins.");
    } finally {
      setLoading(false);
    }
  }

  const users = summary?.users ?? [];

  return (
    <>
      <button
        type="button"
        className="config-window-trigger"
        onClick={() => setOpen(true)}
      >
        Logins
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
                className="config-window admin-logins-window"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
              >
                <header className="config-window-header">
                  <div>
                    <p className="config-window-kicker">Admin logins</p>
                    <h3 id={titleId}>Users signed in · last 24 hours</h3>
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

                <div className="admin-logins-body">
                  <p className="config-window-help">
                    Host-tracked running list of unique Google sign-ins. Users
                    remain listed for 24 hours from their latest sign-in, then
                    drop off automatically.
                  </p>
                  <p className="admin-logins-summary">
                    {loading && !summary
                      ? "Loading sign-in activity…"
                      : summary
                        ? `${summary.uniqueEmails} user${summary.uniqueEmails === 1 ? "" : "s"} · ${summary.count} sign-in${summary.count === 1 ? "" : "s"} in the last ${summary.windowHours} hours`
                        : "No sign-in activity loaded."}
                  </p>

                  {error ? <p className="admin-logins-error">{error}</p> : null}

                  {!loading && summary && users.length === 0 ? (
                    <p className="admin-logins-empty">
                      No Google sign-ins recorded in the last 24 hours.
                    </p>
                  ) : null}

                  {users.length > 0 ? (
                    <ul className="admin-logins-list">
                      {users.map((user) => (
                        <li className="admin-logins-item" key={user.email}>
                          <strong>{user.email}</strong>
                          <span className="admin-logins-meta">
                            <time dateTime={user.lastSeenAt}>
                              Last seen {formatLoginActivityTime(user.lastSeenAt)}
                            </time>
                            <span>
                              {user.signInCount} sign-in
                              {user.signInCount === 1 ? "" : "s"}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="admin-logins-actions">
                    <button
                      type="button"
                      className="admin-login-submit"
                      onClick={() => void refresh()}
                      disabled={loading}
                    >
                      {loading ? "Refreshing…" : "Refresh"}
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
