"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useAdminAuthenticated } from "./admin-auth";
import { ADMIN_CONFIG_DRIVE_FOLDER_URL } from "@/lib/admin-config-drive";
import { syncCustomCardConfig } from "./custom-cards-store";
import { writeDashboardConfig } from "./dashboard-config-store";
import { loadCardConfigFromDriveFile } from "./load-config-from-drive";
import { pickAdminConfigDriveFile } from "./open-admin-config-drive";
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
  const [loadError, setLoadError] = useState<string | null>(null);
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
    setLoadError(null);
    setLoaded(false);
    try {
      // Folder opens via the native <a href> on the Load Config control.
      const picked = await pickAdminConfigDriveFile("card", {
        folderAlreadyOpen: true,
      });
      if (!picked) {
        setLoadError(
          "No Card Configuration file selected. The Google Drive config folder was opened — use Load Config again to select a file.",
        );
        return;
      }
      const next = await loadCardConfigFromDriveFile(picked.id, base);
      if (isCustomCardId(next.dashboardId)) {
        await syncCustomCardConfig(next);
      } else {
        await writeDashboardConfig(next);
      }
      applyConfig(next);
      setLoaded(true);
    } catch (err) {
      setLoaded(false);
      setLoadError(
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
    setLoadError(null);
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
      <a
        className="config-window-trigger"
        href={ADMIN_CONFIG_DRIVE_FOLDER_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          // Native link opens Drive; also show the card Configuration dialog.
          setOpen(true);
        }}
      >
        Configuration
      </a>
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
                    <a
                      className="config-window-load"
                      href={ADMIN_CONFIG_DRIVE_FOLDER_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-disabled={loading}
                      onClick={(event) => {
                        if (loading) {
                          event.preventDefault();
                          return;
                        }
                        void handleLoadConfigFile();
                      }}
                    >
                      {loading ? "Loading…" : "Load Config"}
                    </a>
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
                  Read-only view of this card&apos;s Configuration.{" "}
                  <strong>Load Config</strong> is a direct link to the shared
                  Google Drive folder (
                  <a
                    href={ADMIN_CONFIG_DRIVE_FOLDER_URL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    https://drive.google.com/drive/u/0/folders/1g-pGEPe4f2sFmX0sngp-4Pm75ONGMnks
                  </a>
                  ) so Admin can select a Card Configuration file. Loaded values
                  are saved on the host for all users. Each value must be inside
                  quotes, e.g. Board Name: &quot;Digital Safety Board&quot;.
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
                {loadError ? (
                  <p className="config-window-errors" role="alert">
                    {loadError}
                  </p>
                ) : null}
                {loaded && !hasSyntaxErrors && !loadError ? (
                  <p className="config-window-saved">
                    Configuration loaded from Google Drive
                  </p>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
