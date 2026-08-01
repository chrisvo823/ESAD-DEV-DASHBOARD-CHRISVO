import {
  formatDashboardConfigText,
  parseAllDashboardConfigsFromText,
  type DashboardConfig,
} from "./dashboard-config";
import { isCustomCardId } from "./custom-cards";
import {
  googleDocEditUrl,
  readGoogleDocPlainText,
  writePlainTextToGoogleDoc,
} from "./google-doc-dashboard-config";

/**
 * Shared Google Doc that stores Card Configuration for every user
 * (Admin Drive folder → ESAD_Cards_Config). Same recovery pattern as
 * DASHBOARD_CONFIG_GOOGLE_DOC_ID so cards refill after ephemeral host loss.
 * Override with CARD_CONFIG_GOOGLE_DOC_ID / ESAD_CARD_CONFIG_GOOGLE_DOC_ID.
 */
export const DEFAULT_CARD_CONFIG_GOOGLE_DOC_ID =
  "1F016o0deQemL7Feo5QTZQl1VLgKOuiL5VQzwnM8JVj8";

export function resolveCardConfigGoogleDocId(): string {
  return (
    process.env.CARD_CONFIG_GOOGLE_DOC_ID?.trim() ||
    process.env.ESAD_CARD_CONFIG_GOOGLE_DOC_ID?.trim() ||
    DEFAULT_CARD_CONFIG_GOOGLE_DOC_ID
  );
}

/** @deprecated Prefer resolveCardConfigGoogleDocId() when env overrides matter. */
export const CARD_CONFIG_GOOGLE_DOC_ID = DEFAULT_CARD_CONFIG_GOOGLE_DOC_ID;

export const CARD_CONFIG_GOOGLE_DOC_URL = googleDocEditUrl(
  DEFAULT_CARD_CONFIG_GOOGLE_DOC_ID,
);

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
