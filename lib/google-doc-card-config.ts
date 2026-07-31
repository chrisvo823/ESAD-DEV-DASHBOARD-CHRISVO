import {
  formatDashboardConfigText,
  parseDashboardConfigText,
  type DashboardConfig,
} from "./dashboard-config";
import {
  readGoogleDocPlainText,
  writePlainTextToGoogleDoc,
} from "./google-doc-dashboard-config";

/**
 * Read Card Configuration text from a selected Google Doc and parse it.
 * `base` preserves the internal dashboard/card id (not present in Doc text).
 */
export async function readCardConfigFromGoogleDoc(
  base: DashboardConfig,
  options: {
    documentId: string;
    accessToken?: string | null;
  },
): Promise<DashboardConfig | null> {
  const documentId = options.documentId.trim();
  if (!documentId) return null;
  const text = await readGoogleDocPlainText({
    documentId,
    accessToken: options.accessToken,
  });
  if (!text.trim()) return null;
  const parsed = parseDashboardConfigText(text, base);
  if ("error" in parsed) return null;
  return parsed.config;
}

/**
 * Replace the selected Card Configuration Google Doc with card field text.
 */
export async function writeCardConfigToGoogleDoc(
  config: DashboardConfig,
  documentId: string,
  options?: {
    accessToken?: string | null;
  },
): Promise<{ documentId: string; documentUrl: string; text: string }> {
  return writePlainTextToGoogleDoc(
    documentId,
    formatDashboardConfigText(config),
    { accessToken: options?.accessToken },
  );
}
