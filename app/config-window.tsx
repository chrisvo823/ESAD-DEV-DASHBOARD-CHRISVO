"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useAdminAuthenticated } from "./admin-auth";
import { syncCustomCardConfig } from "./custom-cards-store";
import { writeDashboardConfig } from "./dashboard-config-store";
import type { DashboardConfig } from "../lib/dashboard-config";
import {
  formatDashboardConfigText,
  parseDashboardConfigText,
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
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const titleId = useId();
  const errorId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!authenticated) setOpen(false);
  }, [authenticated]);

  useEffect(() => {
    if (!open) return;
    // Sync draft only when opening so a host refresh cannot wipe edits.
    const nextDraft = formatDashboardConfigText(config);
    setDraft(nextDraft);
    setErrors(validateDashboardConfigSyntax(nextDraft));
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

  function handleDraftChange(value: string) {
    setDraft(value);
    setSaved(false);
    setSaveError(null);
    setErrors(validateDashboardConfigSyntax(value));
  }

  async function handleSave() {
    const syntaxErrors = validateDashboardConfigSyntax(draft);
    if (syntaxErrors.length > 0) {
      setErrors(syntaxErrors);
      setSaved(false);
      setSaveError(null);
      return;
    }

    const parsed = parseDashboardConfigText(draft, config);
    if ("error" in parsed) {
      setErrors(parsed.errors);
      setSaved(false);
      setSaveError(null);
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      if (isCustomCardId(parsed.config.dashboardId)) {
        await syncCustomCardConfig(parsed.config);
      } else {
        await writeDashboardConfig(parsed.config);
      }
      const savedText = formatDashboardConfigText(parsed.config);
      setDraft(savedText);
      setErrors([]);
      setSaved(true);
    } catch (err) {
      setSaved(false);
      setSaveError(
        err instanceof Error
          ? err.message
          : "Failed to save card configuration on the host.",
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
                      {config.boardNickname} · editable card fields
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
                  Saved on the host and shared for all users. Each value must be
                  inside quotes, e.g. Board Name: &quot;Digital Safety Board&quot;.
                </p>
                <textarea
                  className={`config-window-editor${
                    hasSyntaxErrors ? " config-window-editor--error" : ""
                  }`}
                  value={draft}
                  spellCheck={false}
                  aria-invalid={hasSyntaxErrors}
                  aria-label={`Configuration for ${config.boardNickname}`}
                  onChange={(event) => handleDraftChange(event.target.value)}
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
