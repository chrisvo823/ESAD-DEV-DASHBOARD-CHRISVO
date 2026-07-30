import {
  ADMIN_CONFIG_DRIVE_FOLDER_ID,
} from "./admin-config-drive";
import { resolveGoogleDocsAccessToken } from "./google-doc-dashboard-config";
import { googleDriveCredentialsMissingMessage } from "./google-drive-credentials";

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

type DriveAuthError = Error & { status?: number };

async function resolveDriveAccessToken(
  overrideToken?: string | null,
): Promise<string> {
  const accessToken = await resolveGoogleDocsAccessToken(overrideToken);
  if (!accessToken) {
    throw new Error(googleDriveCredentialsMissingMessage());
  }
  return accessToken;
}

async function withDriveTokenFallback<T>(
  overrideToken: string | null | undefined,
  run: (token: string) => Promise<T>,
): Promise<T> {
  const accessToken = await resolveDriveAccessToken(overrideToken);
  try {
    return await run(accessToken);
  } catch (err) {
    const status =
      err && typeof err === "object" && "status" in err
        ? Number((err as { status?: number }).status)
        : 0;
    // Expired client OAuth tokens should not block the service-account fallback.
    if ((status === 401 || status === 403) && overrideToken?.trim()) {
      const fallback = await resolveGoogleDocsAccessToken(null);
      if (!fallback || fallback === accessToken) throw err;
      return run(fallback);
    }
    throw err;
  }
}

/**
 * List Google Docs in the shared Admin config Drive folder.
 * Uses the caller token when provided, otherwise service-account / env credentials.
 */
export async function listAdminConfigDriveFiles(options?: {
  accessToken?: string | null;
}): Promise<AdminConfigDriveListedFile[]> {
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
      const err = new Error(message) as DriveAuthError;
      err.status = response.status;
      throw err;
    }
    return payload;
  }

  const payload = await withDriveTokenFallback(
    options?.accessToken,
    fetchPage,
  );

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

/**
 * Export a Google Doc from the Admin config folder as plain text.
 * Uses the same credential resolution as listing (client token → env → SA).
 */
export async function exportAdminConfigDriveFilePlainText(
  fileId: string,
  options?: { accessToken?: string | null },
): Promise<string> {
  const id = fileId.trim();
  if (!id) {
    throw new Error("A Drive file id is required.");
  }

  return withDriveTokenFallback(options?.accessToken, async (token) => {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}/export?mimeType=text/plain`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "text/plain",
        },
        cache: "no-store",
      },
    );
    if (!response.ok) {
      const body = await response.text();
      const err = new Error(
        `Failed to read Drive file (${response.status}): ${body.slice(0, 240)}`,
      ) as DriveAuthError;
      err.status = response.status;
      throw err;
    }
    return response.text();
  });
}
