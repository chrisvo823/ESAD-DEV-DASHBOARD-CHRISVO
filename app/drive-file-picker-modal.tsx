"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { ADMIN_CONFIG_DRIVE_FOLDER_URL } from "@/lib/admin-config-drive";
import {
  ensureFirebaseWebConfig,
  getFirebaseWebConfig,
} from "../lib/firebase-client";
import { getAdminSessionPassword } from "./admin-auth";
import { ensureGoogleDriveAccessToken } from "./ensure-google-drive-access";
import { getGoogleAccessToken } from "./google-access-token";
import type {
  AdminConfigDriveKind,
  PickedDriveFile,
} from "./admin-config-drive-types";

type ListedFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string | null;
};

type DriveFilePickerModalProps = {
  kind: AdminConfigDriveKind;
  onSelect: (file: PickedDriveFile) => void;
  onCancel: () => void;
};

function kindLabel(kind: AdminConfigDriveKind): string {
  return kind === "dashboard"
    ? "Dashboard Configuration"
    : "Card Configuration";
}

function looksLikeCredentialsError(message: string): boolean {
  return /credential|not configured|unauthorized|401|403|sign in|access token|firebase/i.test(
    message,
  );
}

export function DriveFilePickerModal({
  kind,
  onSelect,
  onCancel,
}: DriveFilePickerModalProps) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<ListedFile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [grantBusy, setGrantBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [firebaseAvailable, setFirebaseAvailable] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await ensureFirebaseWebConfig();
      if (!cancelled) setFirebaseAvailable(Boolean(getFirebaseWebConfig()));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadFiles() {
      setLoading(true);
      setError(null);
      try {
        const password = getAdminSessionPassword();
        if (!password) {
          throw new Error("Admin session required to select a Drive file.");
        }
        const headers: Record<string, string> = {
          "x-esad-admin-password": password,
        };
        const googleToken = getGoogleAccessToken();
        if (googleToken) {
          headers["x-esad-google-access-token"] = googleToken;
        }
        const response = await fetch("/api/admin-config-drive-files", {
          headers,
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          files?: ListedFile[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(
            payload.error?.trim() ||
              `Failed to load Drive files (${response.status}).`,
          );
        }
        if (!cancelled) {
          setFiles(Array.isArray(payload.files) ? payload.files : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load Drive folder files.",
          );
          setFiles([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadFiles();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function handleGrantDriveAccess() {
    setGrantBusy(true);
    setError(null);
    try {
      await ensureGoogleDriveAccessToken({
        reason: `Sign in with Google Drive to choose a ${kindLabel(kind)} Doc.`,
        forcePopup: true,
      });
      setReloadKey((key) => key + 1);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to grant Google Drive access.",
      );
    } finally {
      setGrantBusy(false);
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    };
    // Capture so the parent config window does not also close on Escape.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onCancel]);

  if (!mounted) return null;

  const selected = files.find((file) => file.id === selectedId) ?? null;
  const showDriveLogin =
    Boolean(error) &&
    looksLikeCredentialsError(error ?? "") &&
    firebaseAvailable;

  return createPortal(
    <div
      className="drive-file-picker-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        className="drive-file-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="drive-file-picker-header">
          <div>
            <p className="drive-file-picker-kicker">Select file</p>
            <h3 id={titleId}>Choose a {kindLabel(kind)} file</h3>
          </div>
        </header>
        <p className="drive-file-picker-help">
          Google Docs in the shared Admin Drive folder. Select one, then
          confirm.{" "}
          <a
            href={ADMIN_CONFIG_DRIVE_FOLDER_URL}
            target="_blank"
            rel="noreferrer"
          >
            Open folder
          </a>
        </p>
        <div className="drive-file-picker-body">
          {loading ? (
            <p className="drive-file-picker-status">Loading files…</p>
          ) : null}
          {!loading && error ? (
            <div className="drive-file-picker-error-block" role="alert">
              <p className="drive-file-picker-error">{error}</p>
              {showDriveLogin ? (
                <button
                  type="button"
                  className="config-window-load"
                  disabled={grantBusy}
                  onClick={() => void handleGrantDriveAccess()}
                >
                  {grantBusy
                    ? "Opening Google Drive login…"
                    : "Sign in with Google Drive"}
                </button>
              ) : (
                <p className="drive-file-picker-status">
                  Configure <code>GOOGLE_SERVICE_ACCOUNT_JSON</code> (share the
                  Admin folder with that account) or Firebase{" "}
                  <code>NEXT_PUBLIC_FIREBASE_*</code> /{" "}
                  <code>FIREBASE_WEB_CONFIG</code>, then retry.
                </p>
              )}
            </div>
          ) : null}
          {!loading && !error && files.length === 0 ? (
            <p className="drive-file-picker-status">
              No files found in the shared config folder.
            </p>
          ) : null}
          {!loading && !error && files.length > 0 ? (
            <ul className="drive-file-picker-list" role="listbox">
              {files.map((file) => {
                const selectedFile = file.id === selectedId;
                return (
                  <li key={file.id}>
                    <button
                      type="button"
                      className={`drive-file-picker-item${
                        selectedFile ? " drive-file-picker-item--selected" : ""
                      }`}
                      role="option"
                      aria-selected={selectedFile}
                      onClick={() => setSelectedId(file.id)}
                      onDoubleClick={() =>
                        onSelect({
                          id: file.id,
                          name: file.name,
                          mimeType: file.mimeType,
                        })
                      }
                    >
                      <span className="drive-file-picker-item-name">
                        {file.name}
                      </span>
                      <span className="drive-file-picker-item-meta">
                        {file.mimeType.includes("document")
                          ? "Google Doc"
                          : file.mimeType}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
        <footer className="drive-file-picker-footer">
          <button
            type="button"
            className="config-window-close"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="config-window-load"
            disabled={!selected}
            onClick={() => {
              if (!selected) return;
              onSelect({
                id: selected.id,
                name: selected.name,
                mimeType: selected.mimeType,
              });
            }}
          >
            Select file
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
