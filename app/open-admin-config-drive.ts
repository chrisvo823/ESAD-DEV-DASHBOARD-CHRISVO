"use client";

import { createElement } from "react";
import { createRoot } from "react-dom/client";
import {
  ADMIN_CONFIG_DRIVE_FOLDER_ID,
  ADMIN_CONFIG_DRIVE_FOLDER_URL,
} from "@/lib/admin-config-drive";
import { getGoogleAccessToken } from "@/app/google-access-token";
import { DriveFilePickerModal } from "./drive-file-picker-modal";

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

/**
 * In-app popup listing files from the shared Admin config Drive folder.
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

type GooglePickerResult =
  | { status: "picked"; file: PickedDriveFile }
  | { status: "cancelled" }
  | { status: "unavailable" };

async function showGooglePickerPopup(
  kind: AdminConfigDriveKind,
  accessToken: string,
  developerKey: string,
): Promise<GooglePickerResult> {
  const ready = await ensureGooglePickerApi();
  if (!ready || !window.google?.picker) return { status: "unavailable" };

  const pickerNs = window.google.picker;
  const title =
    kind === "dashboard"
      ? "Select Dashboard Configuration file"
      : "Select Card Configuration file";

  return new Promise<GooglePickerResult>((resolve) => {
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
          resolve({ status: "cancelled" });
          return;
        }
        if (action !== pickerNs.Action.PICKED) return;
        const docs = Array.isArray(data.docs) ? data.docs : [];
        const first = docs[0] as Record<string, unknown> | undefined;
        const id = typeof first?.id === "string" ? first.id.trim() : "";
        if (!id) {
          resolve({ status: "cancelled" });
          return;
        }
        resolve({
          status: "picked",
          file: {
            id,
            name: typeof first?.name === "string" ? first.name : id,
            mimeType:
              typeof first?.mimeType === "string" ? first.mimeType : "",
          },
        });
      })
      .build();

    picker.setVisible(true);
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
 * Drive folder via a file-selection popup (Google Picker when available,
 * otherwise the in-app Drive file list modal). Never asks to paste a URL.
 */
export async function pickAdminConfigDriveFile(
  kind: AdminConfigDriveKind,
  _options: PickAdminConfigDriveOptions = {},
): Promise<PickedDriveFile | null> {
  const accessToken = getGoogleAccessToken();
  const developerKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() || "";

  if (accessToken && developerKey) {
    const result = await showGooglePickerPopup(
      kind,
      accessToken,
      developerKey,
    );
    if (result.status === "picked") return result.file;
    if (result.status === "cancelled") return null;
    // Picker unavailable — fall through to in-app popup.
  }

  return showDriveFilePickerPopup(kind);
}
