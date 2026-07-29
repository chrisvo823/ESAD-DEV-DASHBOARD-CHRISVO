"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useAdminAuthenticated } from "./admin-auth";
import { writeProgramConfig } from "./program-config-store";
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
  const [identityDraft, setIdentityDraft] = useState(() =>
    formatProgramIdentityText(config),
  );
  const [ledDraft, setLedDraft] = useState(() =>
    formatProgramLedThresholdText(config),
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
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

  useEffect(() => {
    if (!open) return;
    // Sync drafts only when the window opens so a later host refresh cannot
    // wipe in-progress (or just-saved) Dashboard Configuration text.
    const nextIdentity = formatProgramIdentityText(config);
    const nextLed = formatProgramLedThresholdText(config);
    setIdentityDraft(nextIdentity);
    setLedDraft(nextLed);
    setErrors(
      validateProgramConfigSyntax(
        combineProgramConfigEditors(nextIdentity, nextLed),
      ),
    );
    setSaved(false);
    setSaveError(null);
    setSaving(false);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // intentionally omit `config` — open transition captures current props
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function syncDrafts(nextIdentity: string, nextLed: string) {
    setIdentityDraft(nextIdentity);
    setLedDraft(nextLed);
    setSaved(false);
    setSaveError(null);
    setErrors(
      validateProgramConfigSyntax(
        combineProgramConfigEditors(nextIdentity, nextLed),
      ),
    );
  }

  async function handleSave() {
    const combined = combineProgramConfigEditors(identityDraft, ledDraft);
    const syntaxErrors = validateProgramConfigSyntax(combined);
    if (syntaxErrors.length > 0) {
      setErrors(syntaxErrors);
      setSaved(false);
      setSaveError(null);
      return;
    }

    const parsed = parseProgramConfigText(combined);
    if ("error" in parsed) {
      setErrors(parsed.errors);
      setSaved(false);
      setSaveError(null);
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await writeProgramConfig(parsed.config);
      setIdentityDraft(formatProgramIdentityText(parsed.config));
      setLedDraft(formatProgramLedThresholdText(parsed.config));
      setErrors([]);
      setSaved(true);
    } catch (err) {
      setSaved(false);
      setSaveError(
        err instanceof Error
          ? err.message
          : "Failed to save Dashboard Configuration on the host.",
      );
    } finally {
      setSaving(false);
    }
  }

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
                      onClick={() => void handleSave()}
                      disabled={hasSyntaxErrors || saving}
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
                  Saved to the shared Google Doc and loaded by every user&apos;s
                  dashboard (
                  <a
                    href="https://docs.google.com/document/d/15XbbNYYGVMyxCgQs6MaQAO-cMLJTyRcF_67F0dmc-vA/edit?usp=drive_link"
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
                  className={`config-window-editor config-window-editor--identity${
                    hasSyntaxErrors ? " config-window-editor--error" : ""
                  }`}
                  value={identityDraft}
                  spellCheck={false}
                  aria-invalid={hasSyntaxErrors}
                  aria-label="Dashboard identity configuration"
                  onChange={(event) =>
                    syncDrafts(event.target.value, ledDraft)
                  }
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
                  value={ledDraft}
                  spellCheck={false}
                  aria-invalid={hasSyntaxErrors}
                  aria-label="Card LED Threshold Configuration"
                  onChange={(event) =>
                    syncDrafts(identityDraft, event.target.value)
                  }
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
                {saveError ? (
                  <p className="config-window-errors" role="alert">
                    {saveError}
                  </p>
                ) : null}
                {saved && !hasSyntaxErrors && !saveError ? (
                  <p className="config-window-saved">
                    Configuration saved on host
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
