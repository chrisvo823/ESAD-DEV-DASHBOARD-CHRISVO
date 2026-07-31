"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAdminAuthenticated } from "./admin-auth";
import { ADMIN_CONFIG_DRIVE_FOLDER_URL } from "@/lib/admin-config-drive";
import {
  bindAllCardConfigsGoogleDoc,
  saveAllCardConfigsToGoogleDoc,
} from "./dashboard-config-store";
import { ensureGoogleDriveAccessToken } from "./ensure-google-drive-access";
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
  parseAllDashboardConfigsFromText,
  resetCardConfigQuotedValues,
  type DashboardConfig,
} from "../lib/dashboard-config";
import { formatCardConfigDocumentText } from "../lib/google-doc-card-config";

function readAllManagedCardConfigs(): DashboardConfig[] {
  const cached = getCachedSiteConfig().dashboardConfigs;
  const customCards = getCachedSiteConfig().customCards;
  const fixed = FIXED_DASHBOARD_IDS.map(
    (id) => cached[id] ?? { ...DASHBOARD_CONFIGS[id] },
  );
  const extras = customCards.map(
    (card) => cached[card.id] ?? { ...card.config, dashboardId: card.id },
  );
  return [...fixed, ...extras];
}

/** Prefer a Doc id already bound by Load Config for any card. */
function resolveBoundCardConfigDocumentId(): string | null {
  const ids = getCachedSiteConfig().cardConfigDocumentIds;
  for (const id of FIXED_DASHBOARD_IDS) {
    const documentId = ids[id]?.trim();
    if (documentId) return documentId;
  }
  for (const documentId of Object.values(ids)) {
    const trimmed = documentId?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function formatEditorDraft(configs: DashboardConfig[]): string {
  // Prefer Doc-style formatting (quoted fixed cards, bare added cards).
  return formatCardConfigDocumentText(configs);
}

/** Top-level Card Configuration control (admin toolbar). */
export function ConfigWindow() {
  const authenticated = useAdminAuthenticated();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [draft, setDraft] = useState(() =>
    formatEditorDraft(readAllManagedCardConfigs()),
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  const titleId = useId();
  const errorId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!authenticated) setOpen(false);
  }, [authenticated]);

  function applyConfigs(configs: DashboardConfig[], options?: { dirty?: boolean }) {
    const nextDraft = formatEditorDraft(configs);
    setDraft(nextDraft);
    const parsed = parseAllDashboardConfigsFromText(nextDraft);
    setErrors("error" in parsed ? parsed.errors : []);
    dirtyRef.current = options?.dirty ?? false;
  }

  function handleDraftChange(nextDraft: string) {
    dirtyRef.current = true;
    setDraft(nextDraft);
    setStatusMessage(null);
    setActionError(null);
    const parsed = parseAllDashboardConfigsFromText(nextDraft);
    setErrors("error" in parsed ? parsed.errors : []);
  }

  function handleResetConfig() {
    setActionError(null);
    const resetDraft = resetCardConfigQuotedValues(draft);
    dirtyRef.current = true;
    setDraft(resetDraft);
    const parsed = parseAllDashboardConfigsFromText(resetDraft);
    setErrors("error" in parsed ? parsed.errors : []);
    setStatusMessage(
      'Cleared values inside " ". Save to publish the reset Card Configuration.',
    );
  }

  async function handleLoadConfigFile() {
    setLoading(true);
    setActionError(null);
    setStatusMessage(null);
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
      applyConfigs(readAllManagedCardConfigs());
      const cardLabels = configs
        .map((config) => `Card #${config.dashboardId}`)
        .join(", ");
      setStatusMessage(
        `Loaded ${cardLabels} from Google Drive and saved for all users. Dashboards refresh every 3 minutes.`,
      );
    } catch (err) {
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

  async function handleSaveConfig() {
    setSaving(true);
    setActionError(null);
    setStatusMessage(null);
    try {
      const parsed = parseAllDashboardConfigsFromText(draft);
      if ("error" in parsed) {
        setErrors(parsed.errors);
        throw new Error(parsed.errors[0] ?? "Fix Card Configuration syntax before Saving.");
      }
      setErrors([]);

      let documentId = resolveBoundCardConfigDocumentId();
      if (!documentId) {
        const picked = await pickAdminConfigDriveFile("card");
        if (!picked) {
          return;
        }
        documentId = picked.id;
      }

      await ensureGoogleDriveAccessToken({
        reason:
          "Sign in with Google Drive so Card Configuration can be saved to the selected Doc.",
      });

      await saveAllCardConfigsToGoogleDoc({
        configs: parsed.configs,
        documentId,
      });
      await refreshSiteConfigFromHost();
      applyConfigs(readAllManagedCardConfigs());
      const cardLabels = parsed.configs
        .map((config) => `Card #${config.dashboardId}`)
        .join(", ");
      setStatusMessage(
        `Saved ${cardLabels} to Google Drive for all users. Dashboards refresh every 3 minutes.`,
      );
    } catch (err) {
      setStatusMessage(null);
      setActionError(
        err instanceof Error
          ? err.message
          : "Failed to save Card Configuration to Google Drive.",
      );
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    applyConfigs(readAllManagedCardConfigs());
    setStatusMessage(null);
    setActionError(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const unsubscribe = subscribeSiteConfig(() => {
      if (dirtyRef.current) return;
      applyConfigs(readAllManagedCardConfigs());
    });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      unsubscribe();
    };
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
                      className="config-window-reset"
                      disabled={busy}
                      onClick={() => {
                        handleResetConfig();
                      }}
                    >
                      Reset
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
                  Edit Card Configuration text, then <strong>Save</strong> to
                  write it back to the selected Google Config file — not only
                  the host cache. <strong>Reset</strong> clears everything
                  inside &quot; &quot; (keeps Card #).{" "}
                  <strong>Load Config</strong> opens a file-selection popup for
                  the shared Google Drive folder (
                  <a
                    href={ADMIN_CONFIG_DRIVE_FOLDER_URL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    https://drive.google.com/drive/u/0/folders/1g-pGEPe4f2sFmX0sngp-4Pm75ONGMnks
                  </a>
                  ). If no Doc is bound yet, Save asks you to pick one. Each
                  Card # section configures the matching card for all users.
                  Accepted forms include Card #: &quot;1&quot;, Card #: 1, or
                  Card #1. New cards use empty fields as &quot; &quot;.
                </p>
                <textarea
                  className={`config-window-editor${
                    hasSyntaxErrors ? " config-window-editor--error" : ""
                  }`}
                  value={draft}
                  spellCheck={false}
                  onChange={(event) => {
                    handleDraftChange(event.target.value);
                  }}
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
                {statusMessage && !actionError ? (
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
