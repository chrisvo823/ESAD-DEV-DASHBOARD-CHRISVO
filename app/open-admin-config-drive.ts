"use client";

import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { ADMIN_CONFIG_DRIVE_FOLDER_URL } from "@/lib/admin-config-drive";
import { DriveFilePickerModal } from "./drive-file-picker-modal";
import type {
  AdminConfigDriveKind,
  PickedDriveFile,
} from "./admin-config-drive-types";

export type { AdminConfigDriveKind, PickedDriveFile };

/**
 * Open the Admin config Drive folder. Must run synchronously inside a click
 * handler — browsers block window.open after await / useEffect.
 */
export function openAdminConfigDriveFolder(): boolean {
  try {
    const anchor = document.createElement("a");
    anchor.href = ADMIN_CONFIG_DRIVE_FOLDER_URL;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return true;
  } catch {
    try {
      const popup = window.open(ADMIN_CONFIG_DRIVE_FOLDER_URL, "_blank");
      if (popup) {
        try {
          popup.opener = null;
        } catch {
          // ignore cross-origin opener assignment failures
        }
        return true;
      }
    } catch {
      // fall through
    }
    return false;
  }
}

const GOOGLE_DOC_ID_RE = /\/document\/d\/([a-zA-Z0-9_-]+)/;
const DRIVE_FILE_ID_RE = /\/file\/d\/([a-zA-Z0-9_-]+)/;
const BARE_FILE_ID_RE = /^[a-zA-Z0-9_-]{25,}$/;

/** Extract a Drive/Docs file id from a pasted URL or bare id. */
export function parseDriveFileIdInput(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const docMatch = value.match(GOOGLE_DOC_ID_RE);
  if (docMatch?.[1]) return docMatch[1];
  const fileMatch = value.match(DRIVE_FILE_ID_RE);
  if (fileMatch?.[1]) return fileMatch[1];
  if (BARE_FILE_ID_RE.test(value)) return value;
  return null;
}

/**
 * In-app popup listing Google Docs from the shared Admin config Drive folder.
 * Replaces the old paste-URL prompt.
 */
function showDriveFilePickerPopup(
  kind: AdminConfigDriveKind,
): Promise<PickedDriveFile | null> {
  return new Promise((resolve) => {
    const host = document.createElement("div");
    host.setAttribute("data-drive-file-picker-root", "1");
    document.body.appendChild(host);
    const root = createRoot(host);

    const finish = (file: PickedDriveFile | null) => {
      root.unmount();
      host.remove();
      resolve(file);
    };

    root.render(
      createElement(DriveFilePickerModal, {
        kind,
        onSelect: (file: PickedDriveFile) => finish(file),
        onCancel: () => finish(null),
      }),
    );
  });
}

export type PickAdminConfigDriveOptions = {
  /**
   * When true, caller already opened the Drive folder tab.
   * The in-app file popup does not require that.
   */
  folderAlreadyOpen?: boolean;
};

/**
 * Require Admin to select a Dashboard/Card configuration file from the shared
 * Drive folder via the in-app file-selection popup. Never asks to paste a URL.
 *
 * Opens the file list immediately (server SA / env token / existing client
 * OAuth). The file picker offers a Google Drive login popup only when listing
 * fails and Firebase Auth is available.
 */
export async function pickAdminConfigDriveFile(
  kind: AdminConfigDriveKind,
  _options: PickAdminConfigDriveOptions = {},
): Promise<PickedDriveFile | null> {
  return showDriveFilePickerPopup(kind);
}
