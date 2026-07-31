"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAdminAuthenticated } from "./admin-auth";
import { ADMIN_CONFIG_DRIVE_FOLDER_URL } from "@/lib/admin-config-drive";
import { loadProgramConfigFromDriveFile } from "./load-config-from-drive";
import { noteConfigLoadedAndDeployIfReady } from "./config-deploy";
import { ensureGoogleDriveAccessToken } from "./ensure-google-drive-access";
import { pickAdminConfigDriveFile } from "./open-admin-config-drive";
import { writeProgramConfig } from "./program-config-store";
import {
  getCachedSiteConfig,
  refreshSiteConfigFromHost,
} from "./site-config-client";
import type { ProgramConfig } from "../lib/program-config";
import {
  combineProgramConfigEditors,
  formatProgramIdentityText,
  formatProgramLedThresholdText,
  parseProgramConfigText,
  validateProgramConfigSyntax,
} from "../lib/program-config";

type ProgramConfigWindowProps = {
  config: ProgramConfig;
};

export function ProgramConfigWindow({ config }: ProgramConfigWindowProps) {
  const authenticated = useAdminAuthenticated();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [identityText, setIdentityText] = useState(() =>
    formatProgramIdentityText(config),
  );
  const [ledText, setLedText] = useState(() =>
    formatProgramLedThresholdText(config),
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  const titleId = useId();
  const identityEditorId = useId();
  const ledEditorId = useId();
  const errorId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!authenticated) setOpen(false);
  }, [authenticated]);

  function applyConfig(next: ProgramConfig, options?: { dirty?: boolean }) {
    const nextIdentity = formatProgramIdentityText(next);
    const nextLed = formatProgramLedThresholdText(next);
    setIdentityText(nextIdentity);
    setLedText(nextLed);
    setErrors(
      validateProgramConfigSyntax(
        combineProgramConfigEditors(nextIdentity, nextLed),
      ),
    );
    dirtyRef.current = options?.dirty ?? false;
  }

  function syncEditorErrors(nextIdentity: string, nextLed: string) {
    setErrors(
      validateProgramConfigSyntax(
        combineProgramConfigEditors(nextIdentity, nextLed),
      ),
    );
  }

  function handleIdentityChange(nextIdentity: string) {
    dirtyRef.current = true;
    setIdentityText(nextIdentity);
    setStatusMessage(null);
    setActionError(null);
    syncEditorErrors(nextIdentity, ledText);
  }

  function handleLedChange(nextLed: string) {
    dirtyRef.current = true;
    setLedText(nextLed);
    setStatusMessage(null);
    setActionError(null);
    syncEditorErrors(identityText, nextLed);
  }

  async function handleLoadConfigFile() {
    setLoading(true);
    setActionError(null);
    setStatusMessage(null);
    try {
      const picked = await pickAdminConfigDriveFile("dashboard");
      if (!picked) {
        // User cancelled the file picker / Drive login — not an error.
        return;
      }
      const next = await loadProgramConfigFromDriveFile(picked.id);
      // Paint loaded identity immediately so the editor cannot stay empty if
      // the subsequent Drive/host write or refresh is slow or partial.
      applyConfig(next);
      await writeProgramConfig(next, { documentId: picked.id });
      await refreshSiteConfigFromHost();
      applyConfig(next);
      const deploy = await noteConfigLoadedAndDeployIfReady({
        dashboard: next,
      });
      setStatusMessage(
        deploy.message ||
          "Loaded Dashboard Configuration from Google Drive and saved for all users.",
      );
    } catch (err) {
      setStatusMessage(null);
      setActionError(
        err instanceof Error
          ? err.message
          : "Failed to load Dashboard Configuration from Google Drive.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveConfig() {
    setSaving(true);
    setActionError(null);
    setStatusMessage(null);
    try {
      const combined = combineProgramConfigEditors(identityText, ledText);
      const parsed = parseProgramConfigText(combined);
      if ("error" in parsed) {
        setErrors(parsed.errors);
        throw new Error(
          parsed.errors[0] ??
            "Fix Dashboard Configuration syntax before Saving.",
        );
      }
      setErrors([]);

      let documentId = getCachedSiteConfig().dashboardConfigDocumentId?.trim() ?? "";
      if (!documentId) {
        const picked = await pickAdminConfigDriveFile("dashboard");
        if (!picked) {
          return;
        }
        documentId = picked.id;
      }

      // Prefer a user OAuth token when available; server can still write via
      // service account / env token if Firebase client auth is unavailable.
      try {
        await ensureGoogleDriveAccessToken({
          reason:
            "Sign in with Google Drive so Dashboard Configuration can be saved to the selected Doc.",
        });
      } catch {
        // Continue — host credentials may still publish the Doc immediately.
      }

      const saved = await writeProgramConfig(parsed.config, { documentId });
      await refreshSiteConfigFromHost();
      applyConfig(saved);
      setStatusMessage(
        "Updated the Google Drive Dashboard Configuration file immediately for all users.",
      );
    } catch (err) {
      setStatusMessage(null);
      setActionError(
        err instanceof Error
          ? err.message
          : "Failed to save Dashboard Configuration to Google Drive.",
      );
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    applyConfig(config);
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
  const busy = loading || saving;

  return (
    <>
      <button
        type="button"
        className="config-window-trigger"
        onClick={() => setOpen(true)}
      >
        Dashboard Configuration
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
                      Dashboard Configuration
                    </p>
                    <h3 id={titleId}>
                      Hero title, metric labels, and card LED thresholds
                    </h3>
                  </div>
                  <div className="config-window-actions">
                    <button
                      type="button"
                      className="config-window-load"
                      disabled={busy}
                      onClick={() => {
                        void handleLoadConfigFile();
                      }}
                    >
                      {loading ? "Loading…" : "Load Config"}
                    </button>
                    <button
                      type="button"
                      className="config-window-save"
                      disabled={busy || hasSyntaxErrors}
                      onClick={() => {
                        void handleSaveConfig();
                      }}
                    >
                      {saving ? "Saving…" : "Save"}
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
                  Edit Dashboard Configuration text, then{" "}
                  <strong>Save</strong> to update the selected Google Drive
                  file immediately for all users. <strong>Load Config</strong>{" "}
                  opens a file-selection popup for the shared Google Drive
                  folder (
                  <a
                    href={ADMIN_CONFIG_DRIVE_FOLDER_URL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    https://drive.google.com/drive/u/0/folders/1g-pGEPe4f2sFmX0sngp-4Pm75ONGMnks
                  </a>
                  ). After both Dashboard and Card Configuration files are
                  loaded, the combined config is deployed to all users. Themes
                  stay in this browser. Accepted forms include Label:
                  &quot;value&quot; or bare Label: value (smart quotes OK). Open
                  Tasks, Over Due, Current Task, and Next Task set the card
                  metric label text. Card status LED thresholds use Over Due
                  counts: Green: &quot;1&quot; lights green when overdue is
                  below Yellow, Yellow: &quot;3&quot; lights yellow when overdue
                  is 3 or more, Red: &quot;5&quot; lights red when overdue is 5
                  or more.
                </p>
                <label
                  className="config-window-section-label"
                  htmlFor={identityEditorId}
                >
                  Dashboard identity and metric labels
                </label>
                <textarea
                  id={identityEditorId}
                  className={`config-window-editor config-window-editor--identity${
                    hasSyntaxErrors ? " config-window-editor--error" : ""
                  }`}
                  value={identityText}
                  spellCheck={false}
                  onChange={(event) => {
                    handleIdentityChange(event.target.value);
                  }}
                  aria-invalid={hasSyntaxErrors}
                  aria-label="Dashboard identity configuration"
                />
                <label
                  className="config-window-section-label"
                  htmlFor={ledEditorId}
                >
                  Card LED Threshold Configuration
                </label>
                <textarea
                  id={ledEditorId}
                  className={`config-window-editor config-window-editor--led${
                    hasSyntaxErrors ? " config-window-editor--error" : ""
                  }`}
                  value={ledText}
                  spellCheck={false}
                  onChange={(event) => {
                    handleLedChange(event.target.value);
                  }}
                  aria-invalid={hasSyntaxErrors}
                  aria-label="Card LED Threshold Configuration"
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
                {statusMessage && !hasSyntaxErrors && !actionError ? (
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
