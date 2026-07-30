/**
 * Server-only task-stats helpers. Imports Node crypto via Google service-account
 * token minting — do not import this module from client components.
 */

import { resolveGoogleDocsAccessToken } from "./google-doc-dashboard-config";
import {
  fetchAllProjectTaskStats,
  type DsbTaskStats,
} from "./dsb-tasks";

/** Fetch Open/Over Due stats, with Drive API fallback for private sheets. */
export async function fetchAllProjectTaskStatsServer(
  fetchImpl: typeof fetch = fetch,
  googleDriveLinksByCode?: Partial<
    Record<"DSB" | "HVFB" | "PRI" | "IND", string>
  >,
): Promise<Partial<Record<"DSB" | "HVFB" | "PRI" | "IND", DsbTaskStats>>> {
  return fetchAllProjectTaskStats(fetchImpl, googleDriveLinksByCode, {
    resolveAccessToken: () => resolveGoogleDocsAccessToken(),
  });
}
