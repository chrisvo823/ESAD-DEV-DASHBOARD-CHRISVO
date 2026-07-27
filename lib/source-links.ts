/**
 * Resolve Card Configuration links that drive metric sources.
 *
 * Google Drive Link → Open Tasks / Over Due (Google Sheet CSV)
 * Smartsheet Link → Current Task / Next Task
 */

import { AVIONICS_MASTER_SCHEDULE_PERMALINK } from "./esad-projects";

/** Numeric Smartsheet id for the Avionics Master Schedule permalink. */
export const AVIONICS_MASTER_SCHEDULE_SHEET_ID = 2069122061913988;

export type MetricSourceStatus = "empty" | "invalid" | "ok";

export type GoogleDriveSource =
  | { status: "empty" }
  | { status: "invalid"; link: string }
  | { status: "ok"; link: string; sheetId: string };

export type SmartsheetSource =
  | { status: "empty" }
  | { status: "invalid"; link: string }
  | { status: "ok"; link: string; permalink: string };

/** Display labels for blank / unusable metric sources. */
export const METRIC_SOURCE_EMPTY = "Empty";
export const METRIC_SOURCE_ERROR = "Error";

export function isBlankLink(link: string | null | undefined): boolean {
  return link == null || link.trim() === "";
}

/**
 * Extract a Google Spreadsheet file id from a Drive / Sheets URL.
 * Folder links and unrelated URLs return null (invalid for Open/Over Due).
 */
export function parseGoogleSheetIdFromLink(
  link: string | null | undefined,
): string | null {
  if (isBlankLink(link)) return null;
  const trimmed = link!.trim();

  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "docs.google.com") {
      const sheetMatch = url.pathname.match(
        /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
      );
      if (sheetMatch?.[1]) return sheetMatch[1];
    }

    if (host === "drive.google.com") {
      // Folders cannot supply Open Tasks / Over Due rows.
      if (/\/drive\/folders\//i.test(url.pathname)) return null;

      const fileMatch = url.pathname.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
      if (fileMatch?.[1]) return fileMatch[1];

      const id = url.searchParams.get("id")?.trim();
      if (id && /^[a-zA-Z0-9-_]+$/.test(id)) return id;
    }
  } catch {
    return null;
  }

  return null;
}

/** True when the link is a usable Google Spreadsheet / Drive file URL. */
export function isValidGoogleDriveSheetLink(
  link: string | null | undefined,
): boolean {
  return parseGoogleSheetIdFromLink(link) != null;
}

export function resolveGoogleDriveSource(
  link: string | null | undefined,
): GoogleDriveSource {
  if (isBlankLink(link)) return { status: "empty" };
  const trimmed = link!.trim();
  const sheetId = parseGoogleSheetIdFromLink(trimmed);
  if (!sheetId) return { status: "invalid", link: trimmed };
  return { status: "ok", link: trimmed, sheetId };
}

/**
 * Normalize a Smartsheet sheet permalink from a Configuration link.
 * Accepts app.smartsheet.com/sheets/{token} URLs (with optional query/hash).
 */
export function parseSmartsheetPermalink(
  link: string | null | undefined,
): string | null {
  if (isBlankLink(link)) return null;
  const trimmed = link!.trim();

  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "app.smartsheet.com") return null;

    const match = url.pathname.match(/^\/sheets\/([A-Za-z0-9]+)\/?$/);
    if (!match?.[1]) return null;

    return `https://app.smartsheet.com/sheets/${match[1]}`;
  } catch {
    return null;
  }
}

export function isValidSmartsheetLink(
  link: string | null | undefined,
): boolean {
  return parseSmartsheetPermalink(link) != null;
}

export function resolveSmartsheetSource(
  link: string | null | undefined,
): SmartsheetSource {
  if (isBlankLink(link)) return { status: "empty" };
  const trimmed = link!.trim();
  const permalink = parseSmartsheetPermalink(trimmed);
  if (!permalink) return { status: "invalid", link: trimmed };
  return { status: "ok", link: trimmed, permalink };
}

/**
 * Configuration Smartsheet Link used for Current Task / Next Task label hrefs.
 * Returns the normalized sheet permalink, or null when the link is blank/invalid.
 */
export function smartsheetHrefFromConfig(
  link: string | null | undefined,
): string | null {
  return parseSmartsheetPermalink(link);
}

/**
 * True when an existing metric href points at the same Smartsheet sheet as
 * the Configuration Smartsheet Link (row deep-links are allowed).
 */
export function hrefMatchesSmartsheetConfig(
  href: string | null | undefined,
  smartsheetLink: string | null | undefined,
): boolean {
  const sheet = parseSmartsheetPermalink(smartsheetLink);
  if (!sheet || isBlankLink(href)) return false;
  return parseSmartsheetPermalink(href) === sheet;
}

/**
 * Resolve a Smartsheet Configuration link to the numeric sheet id we can fetch.
 * Unknown permalinks return null (live schedule fetch unavailable; links still work).
 */
export function resolveSmartsheetSheetIdFromLink(
  link: string | null | undefined,
): number | null {
  const permalink = parseSmartsheetPermalink(link);
  if (!permalink) return null;
  if (permalink === AVIONICS_MASTER_SCHEDULE_PERMALINK) {
    return AVIONICS_MASTER_SCHEDULE_SHEET_ID;
  }
  return null;
}

export function metricSourceStatus(
  source: { status: MetricSourceStatus },
): MetricSourceStatus {
  return source.status;
}
