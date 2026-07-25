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
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, config]);

  function syncDrafts(nextIdentity: string, nextLed: string) {
    setIdentityDraft(nextIdentity);
    setLedDraft(nextLed);
    setSaved(false);
    setErrors(
      validateProgramConfigSyntax(
        combineProgramConfigEditors(nextIdentity, nextLed),
      ),
    );
  }

  function handleSave() {
    const combined = combineProgramConfigEditors(identityDraft, ledDraft);
    const syntaxErrors = validateProgramConfigSyntax(combined);
    if (syntaxErrors.length > 0) {
      setErrors(syntaxErrors);
      setSaved(false);
      return;
    }

    const parsed = parseProgramConfigText(combined);
    if ("error" in parsed) {
      setErrors(parsed.errors);
      setSaved(false);
      return;
    }

    writeProgramConfig(parsed.config);
    setIdentityDraft(formatProgramIdentityText(parsed.config));
    setLedDraft(formatProgramLedThresholdText(parsed.config));
    setErrors([]);
    setSaved(true);
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
                      Hero title, program lead, and card LED thresholds
                    </h3>
                  </div>
                  <div className="config-window-actions">
                    <button
                      type="button"
                      className="config-window-save"
                      onClick={handleSave}
                      disabled={hasSyntaxErrors}
                    >
                      Save
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
                  Each value must be inside quotes. Quoted Green / Yellow / Red
                  thresholds set which status LED lights on every card from its
                  Over Due task count.
                </p>
                <label
                  className="config-window-section-label"
                  htmlFor={identityEditorId}
                >
                  Dashboard identity
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
                {saved && !hasSyntaxErrors ? (
                  <p className="config-window-saved">Configuration saved</p>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
