"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useAdminAuthenticated } from "./admin-auth";
import { reloadProgramConfigFromGoogleDoc } from "./program-config-store";
import type { ProgramConfig } from "../lib/program-config";
import {
  combineProgramConfigEditors,
  formatProgramIdentityText,
  formatProgramLedThresholdText,
  validateProgramConfigSyntax,
} from "../lib/program-config";

/** Shared Google Drive Dashboard Configuration Doc (read-only source of truth). */
const DASHBOARD_CONFIG_GOOGLE_DOC_URL =
  "https://docs.google.com/document/d/15XbbNYYGVMyxCgQs6MaQAO-cMLJTyRcF_67F0dmc-vA/edit?tab=t.0";

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
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
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

  function applyConfig(next: ProgramConfig) {
    const nextIdentity = formatProgramIdentityText(next);
    const nextLed = formatProgramLedThresholdText(next);
    setIdentityText(nextIdentity);
    setLedText(nextLed);
    setErrors(
      validateProgramConfigSyntax(
        combineProgramConfigEditors(nextIdentity, nextLed),
      ),
    );
  }

  async function handleLoadConfigFile() {
    setLoading(true);
    setLoadError(null);
    setLoaded(false);
    try {
      const next = await reloadProgramConfigFromGoogleDoc();
      applyConfig(next);
      setLoaded(true);
    } catch (err) {
      setLoaded(false);
      setLoadError(
        err instanceof Error
          ? err.message
          : "Failed to load Dashboard Configuration from Google Drive.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    // Show current values immediately, then pull the latest Google Doc.
    applyConfig(config);
    setLoaded(false);
    setLoadError(null);
    void handleLoadConfigFile();
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
                      className="config-window-save"
                      onClick={() => void handleLoadConfigFile()}
                      disabled={loading}
                    >
                      {loading ? "Loading…" : "Load Config File…"}
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
                  Read-only view pulled from the shared Google Drive Dashboard
                  Configuration Doc. Edits are not allowed here — update the Doc
                  in Google Drive, then use{" "}
                  <strong>Load Config File…</strong> (
                  <a
                    href={DASHBOARD_CONFIG_GOOGLE_DOC_URL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    open Dashboard Configuration Doc
                  </a>
                  ). Themes stay in this browser. Each value must be inside
                  quotes. Open Tasks, Over Due, Current Task, and Next Task set
                  the card metric label text. Card status LED thresholds use Over
                  Due counts: Green: &quot;1&quot; lights green when overdue is
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
                  className={`config-window-editor config-window-editor--identity config-window-editor--readonly${
                    hasSyntaxErrors ? " config-window-editor--error" : ""
                  }`}
                  value={identityText}
                  spellCheck={false}
                  readOnly
                  aria-readonly="true"
                  aria-invalid={hasSyntaxErrors}
                  aria-label="Dashboard identity configuration from Google Drive"
                />
                <label
                  className="config-window-section-label"
                  htmlFor={ledEditorId}
                >
                  Card LED Threshold Configuration
                </label>
                <textarea
                  id={ledEditorId}
                  className={`config-window-editor config-window-editor--led config-window-editor--readonly${
                    hasSyntaxErrors ? " config-window-editor--error" : ""
                  }`}
                  value={ledText}
                  spellCheck={false}
                  readOnly
                  aria-readonly="true"
                  aria-invalid={hasSyntaxErrors}
                  aria-label="Card LED Threshold Configuration from Google Drive"
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
