"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useAdminAuthenticated } from "./admin-auth";
import { ADMIN_CONFIG_DRIVE_FOLDER_URL } from "@/lib/admin-config-drive";
import { syncCustomCardConfig } from "./custom-cards-store";
import { writeDashboardConfig } from "./dashboard-config-store";
import { loadCardConfigFromDriveFile } from "./load-config-from-drive";
import {
  openAdminConfigDriveFolder,
  pickAdminConfigDriveFile,
} from "./open-admin-config-drive";
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

  function handleLoadConfigClick() {
    // Must open Drive synchronously in the click stack (popup blockers).
    openAdminConfigDriveFolder();
    void handleLoadConfigFile();
  }

  async function handleLoadConfigFile(
    base: DashboardConfig = config,
    options: { folderAlreadyOpen?: boolean } = {},
  ) {
    setLoading(true);
    setLoadError(null);
    setLoaded(false);
    try {
      const picked = await pickAdminConfigDriveFile("card", {
        folderAlreadyOpen: options.folderAlreadyOpen ?? true,
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
    // Folder was already opened in the Configuration click handler; continue
    // with file selection (picker / URL paste) without another window.open.
    void handleLoadConfigFile(config, { folderAlreadyOpen: true });
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
        onClick={() => {
          // Open Drive in this click — useEffect cannot open tabs reliably.
          openAdminConfigDriveFolder();
          setOpen(true);
        }}
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
                      onClick={handleLoadConfigClick}
                      disabled={loading}
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
                  Read-only view of this card&apos;s Configuration.{" "}
                  <strong>Load Config</strong> opens the shared Google Drive
                  folder (
                  <a
                    href={ADMIN_CONFIG_DRIVE_FOLDER_URL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    open config folder
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
