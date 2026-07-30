import {
  ADMIN_CONFIG_DRIVE_FOLDER_ID,
} from "./admin-config-drive";
import { resolveGoogleDocsAccessToken } from "./google-doc-dashboard-config";

export type AdminConfigDriveListedFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string | null;
};

type DriveFilesListResponse = {
  files?: Array<{
    id?: string;
    name?: string;
    mimeType?: string;
    modifiedTime?: string;
  }>;
  error?: { message?: string };
};

const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";

/**
 * List Google Docs (and other files) in the shared Admin config Drive folder.
 * Uses the caller token when provided, otherwise service-account / env credentials.
 */
export async function listAdminConfigDriveFiles(options?: {
  accessToken?: string | null;
}): Promise<AdminConfigDriveListedFile[]> {
  const accessToken = await resolveGoogleDocsAccessToken(options?.accessToken);
  if (!accessToken) {
    throw new Error(
      "Google Drive credentials are not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON or sign in with Google.",
    );
  }

  const query = [
    `'${ADMIN_CONFIG_DRIVE_FOLDER_ID}' in parents`,
    "trashed = false",
  ].join(" and ");

  const params = new URLSearchParams({
    q: query,
    pageSize: "100",
    orderBy: "modifiedTime desc",
    fields: "files(id,name,mimeType,modifiedTime)",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  const payload = (await response.json()) as DriveFilesListResponse;
  if (!response.ok) {
    throw new Error(
      payload.error?.message?.trim() ||
        `Failed to list Drive folder files (${response.status}).`,
    );
  }

  const files = Array.isArray(payload.files) ? payload.files : [];
  return files
    .map((file) => {
      const id = typeof file.id === "string" ? file.id.trim() : "";
      const name = typeof file.name === "string" ? file.name.trim() : "";
      if (!id || !name) return null;
      return {
        id,
        name,
        mimeType:
          typeof file.mimeType === "string" && file.mimeType.trim()
            ? file.mimeType.trim()
            : GOOGLE_DOC_MIME,
        modifiedTime:
          typeof file.modifiedTime === "string" ? file.modifiedTime : null,
      } satisfies AdminConfigDriveListedFile;
    })
    .filter((file): file is AdminConfigDriveListedFile => file != null)
    .sort((a, b) => {
      // Prefer Google Docs first, then name.
      const aDoc = a.mimeType === GOOGLE_DOC_MIME ? 0 : 1;
      const bDoc = b.mimeType === GOOGLE_DOC_MIME ? 0 : 1;
      if (aDoc !== bDoc) return aDoc - bDoc;
      return a.name.localeCompare(b.name);
    });
}
