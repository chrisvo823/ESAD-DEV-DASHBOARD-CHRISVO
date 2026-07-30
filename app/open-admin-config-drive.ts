"use client";

import {
  ADMIN_CONFIG_DRIVE_FOLDER_ID,
  ADMIN_CONFIG_DRIVE_FOLDER_URL,
} from "@/lib/admin-config-drive";
import { getGoogleAccessToken } from "@/app/google-access-token";

export type AdminConfigDriveKind = "dashboard" | "card";

type GooglePickerDocsView = {
  setParent: (folderId: string) => GooglePickerDocsView;
  setIncludeFolders: (include: boolean) => GooglePickerDocsView;
  setSelectFolderEnabled: (enabled: boolean) => GooglePickerDocsView;
  setMode: (mode: string) => GooglePickerDocsView;
};

type GooglePickerBuilder = {
  addView: (view: GooglePickerDocsView) => GooglePickerBuilder;
  setOAuthToken: (token: string) => GooglePickerBuilder;
  setDeveloperKey: (key: string) => GooglePickerBuilder;
  setCallback: (
    cb: (data: Record<string, unknown>) => void,
  ) => GooglePickerBuilder;
  enableFeature: (feature: string) => GooglePickerBuilder;
  setTitle: (title: string) => GooglePickerBuilder;
  build: () => { setVisible: (visible: boolean) => void };
};

declare global {
  interface Window {
    google?: {
      picker?: {
        Action: { PICKED: string; CANCEL: string };
        DocsViewMode: { LIST: string };
        Feature: { NAV_HIDDEN: string };
        ViewId: { DOCS: string };
        DocsView: new (viewId?: string) => GooglePickerDocsView;
        PickerBuilder: new () => GooglePickerBuilder;
      };
    };
    gapi?: {
      load: (api: string, cb: () => void) => void;
    };
  }
}

/**
 * Open the Admin config Drive folder. Must run synchronously inside a click
 * handler — browsers block window.open after await / useEffect.
 */
export function openAdminConfigDriveFolder(): boolean {
  try {
    // Prefer a real <a> click — more reliable against popup blockers than
    // window.open from an async React handler chain.
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

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`,
    );
    if (existing) {
      if (existing.dataset.loaded === "1") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error(`Failed to load ${src}`)),
        { once: true },
      );
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "1";
        resolve();
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () => reject(new Error(`Failed to load ${src}`)),
      { once: true },
    );
    document.head.appendChild(script);
  });
}

async function ensureGooglePickerApi(): Promise<boolean> {
  try {
    await loadScript("https://apis.google.com/js/api.js");
    if (!window.gapi?.load) return false;
    await new Promise<void>((resolve) => {
      window.gapi!.load("picker", () => resolve());
    });
    return Boolean(window.google?.picker);
  } catch {
    return false;
  }
}

export type PickedDriveFile = {
  id: string;
  name: string;
  mimeType: string;
};

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

function promptForDriveFile(
  kind: AdminConfigDriveKind,
): PickedDriveFile | null {
  const label =
    kind === "dashboard"
      ? "Dashboard Configuration"
      : "Card Configuration";
  const raw = window.prompt(
    `Google Drive folder opened. Paste the ${label} Google Doc URL (or file id) from that folder:\n${ADMIN_CONFIG_DRIVE_FOLDER_URL}`,
  );
  if (raw == null) return null;
  const id = parseDriveFileIdInput(raw);
  if (!id) {
    window.alert(
      "That does not look like a Google Doc / Drive file URL or id. Open the config folder, copy the Doc link, and try again.",
    );
    return null;
  }
  return { id, name: id, mimeType: "application/vnd.google-apps.document" };
}

export type PickAdminConfigDriveOptions = {
  /** When true, caller already opened the folder in the click handler. */
  folderAlreadyOpen?: boolean;
};

/**
 * Let Admin select a Dashboard/Card config file from the shared Drive folder.
 * Call `openAdminConfigDriveFolder()` synchronously in the click handler first
 * so the folder tab is not blocked; then call this to pick/load the file.
 */
export async function pickAdminConfigDriveFile(
  kind: AdminConfigDriveKind,
  options: PickAdminConfigDriveOptions = {},
): Promise<PickedDriveFile | null> {
  if (!options.folderAlreadyOpen) {
    openAdminConfigDriveFolder();
  }

  const accessToken = getGoogleAccessToken();
  const developerKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() || "";
  if (accessToken && developerKey) {
    const ready = await ensureGooglePickerApi();
    if (ready && window.google?.picker) {
      const pickerNs = window.google.picker;
      const title =
        kind === "dashboard"
          ? "Select Dashboard Configuration file"
          : "Select Card Configuration file";

      const picked = await new Promise<PickedDriveFile | null>((resolve) => {
        const view = new pickerNs.DocsView(pickerNs.ViewId.DOCS)
          .setParent(ADMIN_CONFIG_DRIVE_FOLDER_ID)
          .setIncludeFolders(false)
          .setSelectFolderEnabled(false)
          .setMode(pickerNs.DocsViewMode.LIST);

        const picker = new pickerNs.PickerBuilder()
          .addView(view)
          .enableFeature(pickerNs.Feature.NAV_HIDDEN)
          .setOAuthToken(accessToken)
          .setDeveloperKey(developerKey)
          .setTitle(title)
          .setCallback((data) => {
            const action = String(data.action ?? "");
            if (action === pickerNs.Action.CANCEL) {
              resolve(null);
              return;
            }
            if (action !== pickerNs.Action.PICKED) return;
            const docs = Array.isArray(data.docs) ? data.docs : [];
            const first = docs[0] as Record<string, unknown> | undefined;
            const id = typeof first?.id === "string" ? first.id.trim() : "";
            if (!id) {
              resolve(null);
              return;
            }
            resolve({
              id,
              name: typeof first?.name === "string" ? first.name : id,
              mimeType:
                typeof first?.mimeType === "string" ? first.mimeType : "",
            });
          })
          .build();

        picker.setVisible(true);
      });

      if (picked) return picked;
      // User cancelled picker — do not also prompt.
      return null;
    }
  }

  return promptForDriveFile(kind);
}
