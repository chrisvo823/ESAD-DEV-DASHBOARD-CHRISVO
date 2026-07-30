/**
 * Helpers for Google Drive / Docs credentials used by Admin config Load Config.
 */

type ServiceAccountJson = {
  client_email?: string;
};

function readEnvValue(key: string): string | undefined {
  const fromProcess = process.env[key]?.trim();
  if (fromProcess) return fromProcess;
  const fromGlobal = (globalThis as Record<string, unknown>)[key];
  return typeof fromGlobal === "string" && fromGlobal.trim()
    ? fromGlobal.trim()
    : undefined;
}

/** Service-account email from GOOGLE_SERVICE_ACCOUNT_JSON, if configured. */
export function getConfiguredGoogleServiceAccountEmail(): string | null {
  const raw = readEnvValue("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccountJson;
    const email = parsed.client_email?.trim();
    return email || null;
  } catch {
    return null;
  }
}

export function googleDriveCredentialsMissingMessage(): string {
  const saEmail = getConfiguredGoogleServiceAccountEmail();
  if (saEmail) {
    return (
      `Google Drive access failed for ${saEmail}. Share the Admin config Drive ` +
      `folder (and docs) with that service account as Viewer or Editor, then retry.`
    );
  }
  return (
    "Google Drive credentials are not configured. Set the " +
    "GOOGLE_SERVICE_ACCOUNT_JSON secret (preferred) or GOOGLE_DOCS_ACCESS_TOKEN, " +
    "share the Admin Drive folder with the service account, or sign in with Google " +
    "and grant Docs/Drive access."
  );
}
