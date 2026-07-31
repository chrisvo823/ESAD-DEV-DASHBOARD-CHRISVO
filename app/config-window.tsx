"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useAdminAuthenticated } from "./admin-auth";
import { ADMIN_CONFIG_DRIVE_FOLDER_URL } from "@/lib/admin-config-drive";
import { syncCustomCardConfig } from "./custom-cards-store";
import { bindCardConfigGoogleDoc } from "./dashboard-config-store";
import { loadCardConfigFromDriveFile } from "./load-config-from-drive";
import { pickAdminConfigDriveFile } from "./open-admin-config-drive";
import {
  getCachedSiteConfig,
  refreshSiteConfigFromHost,
} from "./site-config-client";
import type { DashboardConfig } from "../lib/dashboard-config";
import {
  formatDashboardConfigText,
  validateDashboardConfigSyntax,
} from "../lib/dashboard-config";
import { isCustomCardId } from "../lib/custom-cards";

type ConfigWindowProps = {
  config: DashboardConfig;
};

export function ConfigWindow({ config }: ConfigWindowProps) {
  const authenticated = useAdminAuthenticated();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [draft, setDraft] = useState(() => formatDashboardConfigText(config));
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const titleId = useId();
  const errorId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!authenticated) setOpen(false);
  }, [authenticated]);

  function applyConfig(next: DashboardConfig) {
    const nextDraft = formatDashboardConfigText(next);
    setDraft(nextDraft);
    setErrors(validateDashboardConfigSyntax(nextDraft));
  }

  async function handleLoadConfigFile(base: DashboardConfig = config) {
    setLoading(true);
    setActionError(null);
    setStatusMessage(null);
    setLoaded(false);
    try {
      const picked = await pickAdminConfigDriveFile("card");
      if (!picked) {
        // User cancelled the file picker / Drive login — not an error.
        return;
      }
      const next = await loadCardConfigFromDriveFile(picked.id, base);
      if (isCustomCardId(next.dashboardId)) {
        await syncCustomCardConfig(next);
      }
      // Bind the selected Google Doc and publish card fields for all users.
      await bindCardConfigGoogleDoc({
        config: next,
        documentId: picked.id,
      });
      await refreshSiteConfigFromHost();
      const published =
        getCachedSiteConfig().dashboardConfigs[next.dashboardId] ?? next;
      applyConfig(published);
      setLoaded(true);
      setStatusMessage(
        "Card Configuration loaded from Google Drive and saved for all users. Dashboards refresh every 3 minutes.",
      );
    } catch (err) {
      setLoaded(false);
      setStatusMessage(null);
      setActionError(
        err instanceof Error
          ? err.message
          : "Failed to load Card Configuration from Google Drive.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    applyConfig(config);
    setLoaded(false);
    setStatusMessage(null);
    setActionError(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // intentionally omit `config` — open transition captures current props
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!authenticated) return null;

  const hasSyntaxErrors = errors.length > 0;

  return (
    <>
      <button
        type="button"
        className="config-window-trigger"
        onClick={() => setOpen(true)}
      >
        Configuration
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
                className="config-window"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={hasSyntaxErrors ? errorId : undefined}
              >
                <header className="config-window-header">
                  <div>
                    <p className="config-window-kicker">Configuration Window</p>
                    <h3 id={titleId}>
                      {config.boardNickname} · card configuration
                    </h3>
                  </div>
                  <div className="config-window-actions">
                    <button
                      type="button"
                      className="config-window-load"
                      disabled={loading}
                      onClick={() => {
                        void handleLoadConfigFile();
                      }}
                    >
                      {loading ? "Loading…" : "Load Config"}
                    </button>
                    <button
                      type="button"
                      className="config-window-close"
                      onClick={() => setOpen(false)}
                    >
                      Close
                    </button>
                  </div>
                </header>
                <p className="config-window-help">
                  Read-only view of this card&apos;s Configuration. Values come
                  from the selected Google Config file — not from the host
                  file. <strong>Load Config</strong> opens a file-selection
                  popup for the shared Google Drive folder (
                  <a
                    href={ADMIN_CONFIG_DRIVE_FOLDER_URL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    https://drive.google.com/drive/u/0/folders/1g-pGEPe4f2sFmX0sngp-4Pm75ONGMnks
                  </a>
                  ). Selecting a file updates this window and saves the card
                  Configuration for all users immediately. Each value must be
                  inside quotes, e.g. Board Name: &quot;Digital Safety
                  Board&quot;.
                </p>
                <textarea
                  className={`config-window-editor config-window-editor--readonly${
                    hasSyntaxErrors ? " config-window-editor--error" : ""
                  }`}
                  value={draft}
                  spellCheck={false}
                  readOnly
                  aria-readonly="true"
                  aria-invalid={hasSyntaxErrors}
                  aria-label={`Configuration for ${config.boardNickname}`}
                />
                {hasSyntaxErrors ? (
                  <ul
                    id={errorId}
                    className="config-window-errors"
                    role="alert"
                  >
                    {errors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                ) : null}
                {actionError ? (
                  <p className="config-window-errors" role="alert">
                    {actionError}
                  </p>
                ) : null}
                {loaded && statusMessage && !hasSyntaxErrors && !actionError ? (
                  <p className="config-window-saved">{statusMessage}</p>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
