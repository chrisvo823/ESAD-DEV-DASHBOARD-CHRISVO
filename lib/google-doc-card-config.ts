import {
  formatAllDashboardConfigsText,
  formatDashboardConfigText,
  parseAllDashboardConfigsFromText,
  type DashboardConfig,
} from "./dashboard-config";
import {
  readGoogleDocPlainText,
  writePlainTextToGoogleDoc,
} from "./google-doc-dashboard-config";

/**
 * Read Card Configuration text from a selected Google Doc and parse every
 * Card # section into dashboard configs.
 */
export async function readAllCardConfigsFromGoogleDoc(options: {
  documentId: string;
  accessToken?: string | null;
}): Promise<DashboardConfig[] | null> {
  const documentId = options.documentId.trim();
  if (!documentId) return null;
  const text = await readGoogleDocPlainText({
    documentId,
    accessToken: options.accessToken,
  });
  if (!text.trim()) return null;
  const parsed = parseAllDashboardConfigsFromText(text);
  if ("error" in parsed) return null;
  return parsed.configs;
}

/**
 * Read a single card from a Google Doc (matching `base.dashboardId` when the
 * Doc contains multiple Card # sections).
 */
export async function readCardConfigFromGoogleDoc(
  base: DashboardConfig,
  options: {
    documentId: string;
    accessToken?: string | null;
  },
): Promise<DashboardConfig | null> {
  const configs = await readAllCardConfigsFromGoogleDoc(options);
  if (!configs || configs.length === 0) return null;
  return (
    configs.find((config) => config.dashboardId === base.dashboardId) ??
    configs[0] ??
    null
  );
}

/**
 * Replace the selected Card Configuration Google Doc with one or more card
 * field blocks.
 */
export async function writeCardConfigToGoogleDoc(
  config: DashboardConfig | DashboardConfig[],
  documentId: string,
  options?: {
    accessToken?: string | null;
  },
): Promise<{ documentId: string; documentUrl: string; text: string }> {
  const configs = Array.isArray(config) ? config : [config];
  const text =
    configs.length === 1
      ? formatDashboardConfigText(configs[0]!)
      : formatAllDashboardConfigsText(configs);
  return writePlainTextToGoogleDoc(documentId, text, {
    accessToken: options?.accessToken,
  });
}
