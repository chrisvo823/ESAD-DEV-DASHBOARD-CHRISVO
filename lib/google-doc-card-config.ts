import {
  formatDashboardConfigText,
  parseAllDashboardConfigsFromText,
  type DashboardConfig,
} from "./dashboard-config";
import { isCustomCardId } from "./custom-cards";
import {
  readGoogleDocPlainText,
  writePlainTextToGoogleDoc,
} from "./google-doc-dashboard-config";

/**
 * Format Card Configuration Doc text with quoted values.
 * New/added cards use `" "` for empty fields (Responsible Engineer, links).
 */
export function formatCardConfigDocumentText(
  configs: readonly DashboardConfig[],
): string {
  return configs
    .map((config) =>
      formatDashboardConfigText(config, {
        quoted: true,
        emptyAsQuotedSpace: isCustomCardId(String(config.dashboardId)),
      }),
    )
    .join("\n\n");
}
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
  const text = formatCardConfigDocumentText(configs);
  return writePlainTextToGoogleDoc(documentId, text, {
    accessToken: options?.accessToken,
  });
}
