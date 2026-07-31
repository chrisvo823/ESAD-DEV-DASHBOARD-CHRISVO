"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useAdminAuthenticated } from "./admin-auth";
import { ADMIN_CONFIG_DRIVE_FOLDER_URL } from "@/lib/admin-config-drive";
import { bindAllCardConfigsGoogleDoc } from "./dashboard-config-store";
import { loadAllCardConfigsFromDriveFile } from "./load-config-from-drive";
import { pickAdminConfigDriveFile } from "./open-admin-config-drive";
import {
  getCachedSiteConfig,
  refreshSiteConfigFromHost,
  subscribeSiteConfig,
} from "./site-config-client";
import {
  DASHBOARD_CONFIGS,
  FIXED_DASHBOARD_IDS,
  formatAllDashboardConfigsText,
  parseAllDashboardConfigsFromText,
  type DashboardConfig,
} from "../lib/dashboard-config";

function readFixedCardConfigs(): DashboardConfig[] {
  const cached = getCachedSiteConfig().dashboardConfigs;
  return FIXED_DASHBOARD_IDS.map(
    (id) => cached[id] ?? { ...DASHBOARD_CONFIGS[id] },
  );
}

/** Top-level Card Configuration control (admin toolbar). */
export function ConfigWindow() {
  const authenticated = useAdminAuthenticated();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [draft, setDraft] = useState(() =>
    formatAllDashboardConfigsText(readFixedCardConfigs()),
  );
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

  function applyConfigs(configs: DashboardConfig[]) {
    const nextDraft = formatAllDashboardConfigsText(configs);
    setDraft(nextDraft);
    const parsed = parseAllDashboardConfigsFromText(nextDraft);
    setErrors("error" in parsed ? parsed.errors : []);
  }

  async function handleLoadConfigFile() {
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
      const configs = await loadAllCardConfigsFromDriveFile(picked.id);
      await bindAllCardConfigsGoogleDoc({
        configs,
        documentId: picked.id,
      });
      await refreshSiteConfigFromHost();
      const published = readFixedCardConfigs();
      applyConfigs(published);
      setLoaded(true);
      const cardLabels = configs
        .map((config) => `Card #${config.dashboardId}`)
        .join(", ");
      setStatusMessage(
        `Loaded ${cardLabels} from Google Drive and saved for all users. Dashboards refresh every 3 minutes.`,
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
    applyConfigs(readFixedCardConfigs());
    setLoaded(false);
    setStatusMessage(null);
    setActionError(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const unsubscribe = subscribeSiteConfig(() => {
      applyConfigs(readFixedCardConfigs());
    });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      unsubscribe();
    };
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
        Card Configuration
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
                className="config-window config-window--program"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={hasSyntaxErrors ? errorId : undefined}
              >
                <header className="config-window-header">
                  <div>
                    <p className="config-window-kicker">
                      Card Configuration
                    </p>
                    <h3 id={titleId}>
                      Card # fields for every board card
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
                  Read-only view of Card Configuration. Values come from the
                  selected Google Config file — not from the host file.{" "}
                  <strong>Load Config</strong> opens a file-selection popup for
                  the shared Google Drive folder (
                  <a
                    href={ADMIN_CONFIG_DRIVE_FOLDER_URL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    https://drive.google.com/drive/u/0/folders/1g-pGEPe4f2sFmX0sngp-4Pm75ONGMnks
                  </a>
                  ). Each Card #: &quot;1&quot;–&quot;4&quot; section configures
                  the matching card immediately for all users. Example: Card #:
                  &quot;1&quot; updates Card #1.
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
                  aria-label="Card Configuration for all cards"
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
