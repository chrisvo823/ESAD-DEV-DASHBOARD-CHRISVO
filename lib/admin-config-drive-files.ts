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
    `mimeType = '${GOOGLE_DOC_MIME}'`,
  ].join(" and ");

  async function fetchPage(token: string): Promise<DriveFilesListResponse> {
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
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );
    const payload = (await response.json()) as DriveFilesListResponse;
    if (!response.ok) {
      const message =
        payload.error?.message?.trim() ||
        `Failed to list Drive folder files (${response.status}).`;
      const err = new Error(message) as Error & { status?: number };
      err.status = response.status;
      throw err;
    }
    return payload;
  }

  let payload: DriveFilesListResponse;
  try {
    payload = await fetchPage(accessToken);
  } catch (err) {
    const status =
      err && typeof err === "object" && "status" in err
        ? Number((err as { status?: number }).status)
        : 0;
    // Expired client OAuth tokens should not block the service-account fallback.
    if (
      (status === 401 || status === 403) &&
      options?.accessToken?.trim()
    ) {
      const fallback = await resolveGoogleDocsAccessToken(null);
      if (!fallback || fallback === accessToken) throw err;
      payload = await fetchPage(fallback);
    } else {
      throw err;
    }
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
        mimeType: GOOGLE_DOC_MIME,
        modifiedTime:
          typeof file.modifiedTime === "string" ? file.modifiedTime : null,
      } satisfies AdminConfigDriveListedFile;
    })
    .filter((file): file is AdminConfigDriveListedFile => file != null)
    .sort((a, b) => a.name.localeCompare(b.name));
}
